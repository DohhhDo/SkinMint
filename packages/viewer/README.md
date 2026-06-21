# @skinmint/viewer

A framework-agnostic React component for viewing text-generated 3D models
(GLB/glTF), built on [React Three Fiber](https://r3f.docs.pmnd.rs/) and
[drei](https://github.com/pmndrs/drei).

```bash
pnpm add @skinmint/viewer three @react-three/fiber @react-three/drei
```

`three`, `@react-three/fiber`, and `@react-three/drei` are **peer
dependencies** so your app controls a single shared three.js instance.

## Usage

```tsx
import { GeneratedModelViewer } from "@skinmint/viewer";

export function Demo() {
  return (
    <GeneratedModelViewer
      modelUrl="https://cdn.example.com/models/cute-robot.glb"
      autoRotate
      environment="studio"
      variant="card"
    />
  );
}
```

With no `modelUrl`, the viewer renders an interactive placeholder, so you can
build and style your UI before the generation backend exists.

## Props

| Prop              | Type                              | Default     | Description                                  |
| ----------------- | --------------------------------- | ----------- | -------------------------------------------- |
| `modelUrl`        | `string`                          | —           | GLB/glTF URL. Omit to show a placeholder.    |
| `autoRotate`      | `boolean`                         | `true`      | Slowly spin the model.                       |
| `autoRotateSpeed` | `number`                          | `1`         | Spin speed.                                  |
| `environment`     | `EnvironmentPreset`               | `"studio"`  | Image-based lighting preset.                 |
| `showBackground`  | `boolean`                         | `false`     | Render the environment as the background.    |
| `backgroundColor` | `string`                          | transparent | Solid canvas background color.               |
| `showControls`    | `boolean`                         | `true`      | Orbit / zoom controls.                       |
| `wireframe`       | `boolean`                         | `false`     | Render the model as wireframe.               |
| `shadows`         | `boolean`                         | `true`      | Soft contact shadow under the model.         |
| `variant`         | `"card" \| "full"`                | `"card"`    | Layout preset (height).                      |
| `height`          | `number \| string`                | —           | Explicit height override.                    |
| `draco`           | `boolean`                         | `true`      | Decode Draco-compressed geometry.            |
| `onLoad`          | `() => void`                      | —           | Fired when the model finishes loading.       |
| `onError`         | `(error: unknown) => void`        | —           | Fired when the model fails to load.          |

## Notes

- Built as a client component (`"use client"`), safe to import in Next.js App
  Router. Loads Draco/Meshopt decoders from a CDN by default.
- Pair it with the `@skinmint` generation pipeline (Meshy/Tripo → GLB →
  glTF-Transform) to feed it optimized models.
