#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
角色卡结构探针 —— 批量扫描目录下所有 PNG/JSON，只统计「字段结构」，不输出任何正文。

用法：
    python3 card_probe.py <目录或文件> [更多路径...]
    python3 card_probe.py ~/SillyTavern/data/default-user/characters
    python3 card_probe.py ./cards --json out.json     # 额外导出机器可读结果

设计原则：
  · 零第三方依赖，只用标准库，Python 3.8+ 即可。
  · **不打印任何 content / description / first_mes 正文**，只打印字段名、长度、
    枚举值分布。卡库内容不外泄，输出可以放心贴给别人看。
  · 遇到非角色卡的 PNG（比如 NovelAI/ComfyUI 出的图，它们也带 tEXt chunk）
    不报错，单独计数为 not_a_card。
"""

import base64
import json
import os
import re
import struct
import sys
import zlib
from collections import Counter, defaultdict

# SillyTavern 世界书条目的内部位置枚举（entry.extensions.position）
POS = {0: "before_char", 1: "after_char", 2: "AN_top", 3: "AN_bottom",
       4: "@Depth", 5: "EM_top", 6: "EM_bottom"}
ROLE = {0: "system", 1: "user", 2: "assistant"}

# 卡上的经典文本字段（V2 起就有的那批）
TEXT_FIELDS = ["description", "personality", "scenario", "first_mes", "mes_example",
               "system_prompt", "post_history_instructions", "creator_notes"]


# ── PNG chunk 读取 ────────────────────────────────────────────────────────────
def read_png_text_chunks(path):
    """返回 {keyword: bytes}。tEXt 原样，zTXt 解压后返回。非 PNG 抛异常。"""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("不是 PNG")
    out, i = {}, 8
    while i + 8 <= len(data):
        length = struct.unpack(">I", data[i:i + 4])[0]
        ctype = data[i + 4:i + 8].decode("latin1")
        body = data[i + 8:i + 8 + length]
        if ctype == "tEXt" and b"\x00" in body:
            kw, val = body.split(b"\x00", 1)
            out[kw.decode("latin1")] = val
        elif ctype == "zTXt" and b"\x00" in body:
            kw, rest = body.split(b"\x00", 1)
            try:
                out[kw.decode("latin1")] = zlib.decompress(rest[1:])
            except zlib.error:
                pass
        i += 12 + length
        if ctype == "IEND":
            break
    return out


def load_card(path):
    """
    返回 (card_dict, meta)；不是卡则返回 (None, meta)。
    meta 里带 chunk 清单，方便判断这张图到底是什么东西。
    """
    meta = {"file": os.path.basename(path), "size": os.path.getsize(path)}
    if path.lower().endswith(".json"):
        with open(path, "r", encoding="utf-8") as f:
            try:
                j = json.load(f)
            except Exception as e:
                meta["error"] = f"JSON 解析失败: {e}"
                return None, meta
        meta["chunks"] = ["<json>"]
        meta["has_ccv3"] = meta["has_chara"] = False
        # 同一个 .json 后缀底下混着三种完全不同的东西，必须先认清是哪种再分析：
        #   · 角色卡      → 有 name / data.name
        #   · 预设(Master) → 有 prompts + prompt_order，属于 Chat Completion 设置
        #   · 独立世界书   → 只有 entries，没有卡的身份字段
        # 不区分的话，扫 ST 的 OpenAI Settings 目录会把整批预设误当成卡统计。
        if not isinstance(j, dict):
            meta["error"] = "JSON 顶层不是对象"
            return None, meta
        if "prompts" in j and "prompt_order" in j:
            meta["kind"] = "预设(Chat Completion Master)"
            meta["error"] = (f"这是预设不是角色卡：prompts {len(j.get('prompts') or [])} 条, "
                             f"prompt_order {len(j.get('prompt_order') or [])} 组")
            return None, meta
        body = j.get("data") if isinstance(j.get("data"), dict) else j
        if "entries" in j and not body.get("name"):
            n = j["entries"]
            meta["kind"] = "独立世界书(lorebook)"
            meta["error"] = f"这是世界书不是角色卡：entries {len(n)} 条"
            return None, meta
        if not body.get("name") and not body.get("first_mes") and not body.get("description"):
            meta["error"] = "JSON 里没有任何角色卡身份字段"
            return None, meta
        meta["kind"] = "角色卡(JSON)"
        return j, meta

    try:
        chunks = read_png_text_chunks(path)
    except Exception as e:
        meta["error"] = str(e)
        return None, meta

    meta["chunks"] = sorted(chunks.keys())
    meta["has_ccv3"] = "ccv3" in chunks
    meta["has_chara"] = "chara" in chunks
    # 规范要求两个都在时优先 ccv3；实测两者常常字节相同，但按规范走没有成本
    raw = chunks.get("ccv3") or chunks.get("chara")
    if not raw:
        return None, meta
    if meta["has_ccv3"] and meta["has_chara"]:
        meta["two_chunks_identical"] = (
            base64.b64decode(chunks["ccv3"]) == base64.b64decode(chunks["chara"]))
    try:
        return json.loads(base64.b64decode(raw)), meta
    except Exception as e:
        meta["error"] = f"卡数据解码失败: {e}"
        return None, meta


# ── 单卡分析 ──────────────────────────────────────────────────────────────────
def analyse(card, meta):
    """把一张卡压成纯结构信息。绝不带正文。"""
    data = card.get("data", card)
    ext = data.get("extensions") or {}
    r = dict(meta)
    r["spec"] = card.get("spec") or "(无 spec，疑似 V1)"
    r["spec_version"] = card.get("spec_version")
    r["name_len"] = len(data.get("name") or "")
    r["has_nickname"] = bool(data.get("nickname"))
    r["has_assets"] = bool(data.get("assets"))
    r["has_source"] = bool(data.get("source"))
    r["has_multilingual"] = bool(data.get("creator_notes_multilingual"))
    r["tags_n"] = len(data.get("tags") or [])
    r["creator_set"] = bool(data.get("creator"))

    r["fields"] = {f: len(data.get(f) or "") for f in TEXT_FIELDS}
    r["alt_greetings"] = [len(x) for x in (data.get("alternate_greetings") or [])]
    r["group_greetings_n"] = len(data.get("group_only_greetings") or [])

    r["card_ext_keys"] = sorted(ext.keys())
    r["regex_scripts_n"] = len(ext.get("regex_scripts") or [])
    helper = ext.get("tavern_helper")
    r["tavern_helper_type"] = type(helper).__name__ if helper is not None else None
    blob = json.dumps(helper, ensure_ascii=False) if helper else ""
    r["helper_len"] = len(blob)
    # 远程脚本检测：卡里的前端脚本从外部 URL 拉代码，是导入器必须拒绝执行的信号
    r["helper_remote_import"] = ("import" in blob and "http" in blob)

    book = data.get("character_book")
    if not book:
        r["entries_n"] = 0
        return r
    entries = book.get("entries") or []
    r["entries_n"] = len(entries)
    r["book_level"] = {k: book[k] for k in
                       ("scan_depth", "token_budget", "recursive_scanning")
                       if k in book}

    spec_pos, ext_pos, roles, depths = Counter(), Counter(), Counter(), Counter()
    ext_key_union, deco_count, mismatch = set(), Counter(), 0
    const_n = enabled_n = regex_n = selective_n = sec_keys_n = 0
    keys_empty_n = 0
    comma_keys, macro_keys = [], []

    for e in entries:
        x = e.get("extensions") or {}
        ext_key_union |= set(x.keys())
        sp = e.get("position")
        xp = POS.get(x.get("position"), x.get("position"))
        spec_pos[str(sp)] += 1
        ext_pos[str(xp)] += 1
        # 规范层 position 只有 before_char/after_char 两个值，表达不了 @Depth 等，
        # 因此它和 extensions.position 可能给出不同答案。这里统计冲突条数。
        if sp is not None and xp is not None and str(sp) != str(xp):
            mismatch += 1
        roles[str(ROLE.get(x.get("role"), x.get("role")))] += 1
        depths[str(x.get("depth"))] += 1
        if e.get("constant"):
            const_n += 1
        if e.get("enabled"):
            enabled_n += 1
        if e.get("use_regex"):
            regex_n += 1
        if e.get("selective"):
            selective_n += 1
        if e.get("secondary_keys"):
            sec_keys_n += 1
        if not (e.get("keys") or []):
            keys_empty_n += 1
        for k in (e.get("keys") or []):
            if not isinstance(k, str):
                continue
            # 规范里 keys 每个元素应是一个独立关键词。实测有作者把多个别名写成
            # 「甲，乙」塞进同一个元素，ST 会把整串当一个词匹配 → 永不命中。
            if re.search(r"[，,、;；]", k):
                comma_keys.append(k)
            if re.search(r"\{\{|<user>|<char>|<bot>", k):
                macro_keys.append(k)
        for line in (e.get("content") or "").split("\n"):
            s = line.strip()
            if s.startswith("@@"):
                deco_count[s.split()[0]] += 1

    r["spec_pos"] = dict(spec_pos)
    r["ext_pos"] = dict(ext_pos)
    r["roles"] = dict(roles)
    r["depths"] = dict(depths)
    r["pos_mismatch"] = mismatch
    r["const_n"] = const_n
    r["enabled_n"] = enabled_n
    r["use_regex_n"] = regex_n
    r["selective_n"] = selective_n
    r["secondary_keys_n"] = sec_keys_n
    r["keys_empty_n"] = keys_empty_n
    r["entry_ext_keys"] = sorted(ext_key_union)
    r["decorators"] = dict(deco_count)
    r["comma_keys"] = comma_keys
    r["macro_keys"] = macro_keys

    # 条目体积：实测有单条塞 2.7 万字「原文」的卡，一条命中就能顶穿 token 预算。
    # 导入器需要据此设单条长度闸，所以这里把分布摊开。
    lens = sorted(len(e.get("content") or "") for e in entries)
    r["entry_lens"] = {
        "total": sum(lens),
        "max": lens[-1] if lens else 0,
        "median": lens[len(lens) // 2] if lens else 0,
        "over_2000": sum(1 for x in lens if x > 2000),
        "over_5000": sum(1 for x in lens if x > 5000),
        "over_10000": sum(1 for x in lens if x > 10000),
    }
    return r


# ── 汇总 ──────────────────────────────────────────────────────────────────────
def report(results, not_cards):
    n = len(results)
    print("=" * 78)
    print(f"卡 {n} 张 | 非卡文件 {len(not_cards)} 个")
    if not n:
        return
    print("=" * 78)

    print("\n【逐卡概览】")
    hdr = (f"{'文件':32s} {'spec':6s} {'条目':>4s} {'desc':>6s} {'pers':>5s} "
           f"{'scen':>5s} {'1stmes':>7s} {'例话':>5s} {'sys':>5s} {'PHI':>5s} {'位置冲突':>8s}")
    print(hdr)
    print("-" * len(hdr))
    for r in results:
        f = r["fields"]
        spec = "v3" if r.get("spec") == "chara_card_v3" else \
               "v2" if r.get("spec") == "chara_card_v2" else "?"
        print(f"{r['file'][:32]:32s} {spec:6s} {r['entries_n']:4d} "
              f"{f['description']:6d} {f['personality']:5d} {f['scenario']:5d} "
              f"{f['first_mes']:7d} {f['mes_example']:5d} {f['system_prompt']:5d} "
              f"{f['post_history_instructions']:5d} {r.get('pos_mismatch', 0):8d}")

    print("\n【字段填充率】有内容的卡数 / 总卡数")
    for field in TEXT_FIELDS:
        k = sum(1 for r in results if r["fields"][field] > 0)
        bar = "█" * round(20 * k / n)
        print(f"  {field:28s} {k:3d}/{n:<3d} {100*k/n:5.1f}%  {bar}")
    for label, key in [("alternate_greetings", "alt_greetings"),
                       ("character_book", "entries_n"),
                       ("assets", "has_assets"),
                       ("nickname", "has_nickname"),
                       ("source", "has_source"),
                       ("regex_scripts", "regex_scripts_n")]:
        k = sum(1 for r in results if r.get(key))
        bar = "█" * round(20 * k / n)
        print(f"  {label:28s} {k:3d}/{n:<3d} {100*k/n:5.1f}%  {bar}")

    tot_entries = sum(r["entries_n"] for r in results)
    print(f"\n【世界书条目合计 {tot_entries} 条】")
    if tot_entries:
        agg = lambda key: sum(r.get(key, 0) for r in results)
        print(f"  constant=true        {agg('const_n'):5d}")
        print(f"  enabled=true         {agg('enabled_n'):5d}")
        print(f"  keys 为空            {agg('keys_empty_n'):5d}")
        print(f"  use_regex=true       {agg('use_regex_n'):5d}   "
              f"({100*agg('use_regex_n')/tot_entries:.0f}% —— 若接近 100% 说明是导出默认值，不可信)")
        print(f"  selective=true       {agg('selective_n'):5d}")
        print(f"  secondary_keys 非空  {agg('secondary_keys_n'):5d}   "
              f"(selective 只有配上它才有意义)")
        print(f"  规范/内部 position 冲突 {agg('pos_mismatch'):5d}")

        for label, key in [("规范层 position", "spec_pos"), ("内部 position", "ext_pos"),
                           ("role", "roles"), ("depth", "depths")]:
            c = Counter()
            for r in results:
                c.update(r.get(key, {}))
            print(f"  {label:18s} {dict(c.most_common())}")

        deco = Counter()
        for r in results:
            deco.update(r.get("decorators", {}))
        print(f"  V3 @@装饰器          {dict(deco) if deco else '一个都没有'}")

        ck = [k for r in results for k in r.get("comma_keys", [])]
        mk = [k for r in results for k in r.get("macro_keys", [])]
        if ck:
            print(f"  ⚠ keys 元素内含分隔符（ST 会当整串匹配，几乎永不命中）: {len(ck)} 个")
            for k in ck[:8]:
                print(f"      {k!r}")
        if mk:
            print(f"  ⚠ keys 元素内含宏（匹配前必须先展开）: {len(mk)} 个")
            for k in mk[:8]:
                print(f"      {k!r}")

        vols = [r.get("entry_lens") or {} for r in results if r.get("entry_lens")]
        if vols:
            biggest = max(vols, key=lambda v: v.get("max", 0))
            print(f"\n【条目体积】单条最长 {biggest.get('max')} 字  "
                  f"(>2000字: {sum(v.get('over_2000',0) for v in vols)} 条, "
                  f">5000字: {sum(v.get('over_5000',0) for v in vols)} 条, "
                  f">10000字: {sum(v.get('over_10000',0) for v in vols)} 条)")
            print("  按卡的世界书总字数（降序，前 10）:")
            ranked = sorted(results, key=lambda r: (r.get("entry_lens") or {}).get("total", 0),
                            reverse=True)
            for r in ranked[:10]:
                v = r.get("entry_lens") or {}
                if not v.get("total"):
                    continue
                print(f"    {r['file'][:40]:40s} 总 {v['total']:7d} 字 / "
                      f"{r['entries_n']:3d} 条 / 最长 {v['max']:6d} / 中位 {v['median']:5d}")

        union = set()
        for r in results:
            union |= set(r.get("entry_ext_keys", []))
        print(f"  条目 extensions 键并集（{len(union)} 个）:\n    {sorted(union)}")

    helper_types = Counter(str(r.get("tavern_helper_type")) for r in results)
    remote = sum(1 for r in results if r.get("helper_remote_import"))
    print(f"\n【前端脚本】tavern_helper 类型分布 {dict(helper_types)}")
    print(f"  含远程 import 的卡: {remote} 张  ← 导入器必须拒绝执行这些脚本")

    ident = [r.get("two_chunks_identical") for r in results if "two_chunks_identical" in r]
    if ident:
        print(f"\n【双 chunk】chara 与 ccv3 字节相同: {sum(1 for x in ident if x)}/{len(ident)}")

    if not_cards:
        print("\n【非角色卡文件】")
        for m in not_cards[:12]:
            why = m.get("error") or "有 tEXt 但无 chara/ccv3"
            print(f"  {m['file'][:44]:44s} {why[:30]:30s} chunks={m.get('chunks')}")
        if len(not_cards) > 12:
            print(f"  …… 另有 {len(not_cards)-12} 个")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    json_out = None
    if "--json" in sys.argv:
        idx = sys.argv.index("--json")
        if idx + 1 < len(sys.argv):
            json_out = sys.argv[idx + 1]
    if not args:
        print(__doc__)
        sys.exit(1)

    paths = []
    for a in args:
        if a == json_out:
            continue
        if os.path.isdir(a):
            for root, _, files in os.walk(a):
                for fn in files:
                    if fn.lower().endswith((".png", ".json")):
                        paths.append(os.path.join(root, fn))
        elif os.path.isfile(a):
            paths.append(a)

    results, not_cards = [], []
    for p in sorted(paths):
        card, meta = load_card(p)
        if card is None:
            not_cards.append(meta)
            continue
        try:
            results.append(analyse(card, meta))
        except Exception as e:
            meta["error"] = f"分析失败: {type(e).__name__}: {e}"
            not_cards.append(meta)

    report(results, not_cards)
    if json_out:
        with open(json_out, "w", encoding="utf-8") as f:
            json.dump({"cards": results, "not_cards": not_cards},
                      f, ensure_ascii=False, indent=2)
        print(f"\n结构数据已写入 {json_out}（同样不含任何正文）")


if __name__ == "__main__":
    main()
