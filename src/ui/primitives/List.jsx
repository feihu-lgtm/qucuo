// 列表原语：纵向排列、条目间距 6px，去掉 <ul> 默认的缩进与圆点。
import React from "react";

export default function List({ as: Tag = "ul", className = "", children, ...rest }) {
  return <Tag className={className ? `ui-list ${className}` : "ui-list"} {...rest}>{children}</Tag>;
}
