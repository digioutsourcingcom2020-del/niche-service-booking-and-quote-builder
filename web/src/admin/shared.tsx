import type { JSX } from 'solid-js';

export function PageHead(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: JSX.Element;
}) {
  return (
    <div class="page-head">
      <div>
        <p class="eyebrow dark">{props.eyebrow ?? 'Studio operations'}</p>
        <h1>{props.title}</h1>
        {props.subtitle ? <p class="page-sub">{props.subtitle}</p> : null}
      </div>
      <div class="page-actions">{props.children}</div>
    </div>
  );
}
