import type { DetailedHTMLProps, HTMLAttributes } from "react";

// Let TSX accept the <skinmint-model> custom element with its attributes.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "skinmint-model": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        background?: string;
        "auto-rotate"?: string;
        "rotate-speed"?: string;
        exposure?: string;
        animation?: string;
      };
    }
  }
}

export {};
