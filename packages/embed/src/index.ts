import { SkinMintModel, defineSkinMintModel } from "./skinmint-model";

// Importing the package (or loading the global script) registers <skinmint-model>.
defineSkinMintModel();

export { SkinMintModel, defineSkinMintModel };

declare global {
  interface HTMLElementTagNameMap {
    "skinmint-model": SkinMintModel;
  }
}
