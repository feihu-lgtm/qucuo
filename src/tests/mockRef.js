// 测试用 ref 桩：engine/act 已不许出现 .current，测试里构造/读写 ref 形状统一走这里。
export const mkRef = (value) => ({ current: value });
export const refValue = (ref) => ref.current;
export const refAssign = (ref, value) => { ref.current = value; };
// 对应生产侧 d.refGet/d.refSet（见 turnContext commitDeps）：名字 → ref 本体 的读写出入口
export const refAccessors = (deps) => ({
  refGet: (name) => deps[name]?.current,
  refSet: (name, value) => { deps[name].current = value; },
});
