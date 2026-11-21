const expand = (left, right, render) => left.flatMap((a) => right.map((b) => render(a, b)));
const connectorA = ["与此同时", "几乎同时", "趁势", "恰在此时", "转瞬之间", "后发先至", "抢先一步", "一招未尽", "攻守相接", "劲风交错", "不料", "谁知", "偏在此刻", "前后相承", "一进一退", "方寸之间", "趁其未稳", "电光石火间", "彼此之间", "各自一招"];
const connectorB = ["两招相连", "气机相触", "前后呼应", "各自生变", "招势相映", "胜负初分", "势头互换", "劲力交缠", "攻守易位", "身影交错"];

export const CONNECTORS = expand(connectorA, connectorB, (a, b) => `${a}${b}`);
export const CONNECTOR_FAMILIES = {
  simultaneous: CONNECTORS.slice(0, 40),
  sequential: CONNECTORS.slice(40, 80),
  contrast: CONNECTORS.slice(80, 120),
  preempt: CONNECTORS.slice(120, 160),
  exchange: CONNECTORS.slice(160, 200),
};
