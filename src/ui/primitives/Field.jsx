// 表单项原语：标签 + 控件。控件由调用方给出（<input>/<select>/<textarea>，挂 ui-input 类），
// Field 只负责标签的样式与 label↔控件的关联。也可只用 FieldLabel 单独放一行标签。
import React, { useId } from "react";

export function FieldLabel({ as: Tag = "div", className = "", children, ...rest }) {
  return <Tag className={className ? `ui-field-label ${className}` : "ui-field-label"} {...rest}>{children}</Tag>;
}

export default function Field({ label, children, className = "" }) {
  const id = useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children, { id: children.props.id || id })
    : children;
  return (
    <div className={className || undefined}>
      <FieldLabel as="label" htmlFor={React.isValidElement(children) ? (children.props.id || id) : undefined}>{label}</FieldLabel>
      {control}
    </div>
  );
}
