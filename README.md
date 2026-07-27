# @artisanpack-ui/hooks-js

WordPress-style actions and filters for JavaScript, with a React adapter.

Part of the [ArtisanPack UI](https://github.com/ArtisanPack-UI) ecosystem. This package is the JavaScript counterpart to [`artisanpack-ui/hooks`](https://github.com/ArtisanPack-UI/hooks) for PHP.

## Status

Early scaffold. The public API is not yet stable.

## Installation

```bash
npm install @artisanpack-ui/hooks-js
```

## Usage

The core entry point exposes framework-agnostic hook primitives:

```ts
import { /* actions & filters */ } from '@artisanpack-ui/hooks-js';
```

React bindings are shipped from a dedicated subpath so consumers who don't use React pay nothing for it:

```ts
import { /* React hooks */ } from '@artisanpack-ui/hooks-js/react';
```

## Development

```bash
npm install
npm run build
npm test
npm run lint
npm run type-check
```

## License

[MIT](./LICENSE)
