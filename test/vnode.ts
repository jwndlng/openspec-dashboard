// Walks Preact VNodes without a DOM: enough to assert on what a hook-free component or the Markdown renderer produces.
import type { ComponentChildren, VNode } from "preact";

type Props = Record<string, unknown> & { children?: ComponentChildren };

function isVNode(node: unknown): node is VNode<Props> {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

/** A function component's output, or undefined when it needs a renderer (it uses hooks). */
function expand(node: VNode<Props>): ComponentChildren | undefined {
  try {
    return (node.type as (props: Props) => ComponentChildren)(node.props);
  } catch {
    return undefined;
  }
}

/**
 * Every element in document order. Hook-free function components are expanded by calling them; one that uses hooks
 * stays in the list as a leaf, so its props (a copy button's text) can still be asserted on.
 */
export function elements(node: ComponentChildren): VNode<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isVNode(node)) return [];
  if (typeof node.type === "function") {
    const output = expand(node);
    return output === undefined ? [node] : elements(output);
  }
  return [node, ...elements(node.props.children)];
}

export function byComponent(node: ComponentChildren, component: unknown): VNode<Props>[] {
  return elements(node).filter((el) => el.type === component);
}

export function byTag(node: ComponentChildren, tag: string): VNode<Props>[] {
  return elements(node).filter((el) => el.type === tag);
}

export function textOf(node: ComponentChildren): string {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isVNode(node)) return "";
  if (typeof node.type === "function") return textOf(expand(node) ?? null);
  return textOf(node.props.children);
}
