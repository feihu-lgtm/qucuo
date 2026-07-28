# 本地曲库放这里

`src/musicPlayer.js` 的 `TRACKS` 里，凡是写了 `file:` 的曲目都从这个目录读，
路径是 `file` 字段的值（相对 public 根，**不带前导斜杠** —— 前导斜杠会在
GitHub Pages 的 `/qucuo/` 子路径下 404，见 musicPlayer.js 顶部注释）。

当前 `TRACKS` 声明了但**文件还没放进来**的：

| file | 曲目 |
|---|---|
| `music/zood.mp3` | Zood — 丁真 |
| `music/yan-distance.mp3` | 烟 Distance — 丁真 feat. 硫克克硫 |

这两首现在点下去会在面板上显示「找不到音频文件（曲库文件缺失或路径不对）」。
把 mp3 放进来之后，去 `src/musicPlayer.test.js` 里把 `KNOWN_MISSING` 对应的条目
删掉，那条守卫测试就会开始真正校验文件存在。

注意版权：外链曲目（`remote:`）目前来自 archive.org；这两首本地曲的 `source`
指向 audiomack，来源与许可需要自己确认，面板上的文案已经不再统一声称
「archive.org · 无版权音乐」。
