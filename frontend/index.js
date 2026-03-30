import { registerRootComponent } from "expo";
import { Platform } from 'react-native';

// Polyfill Platform globally to fix ReferenceError: Property 'Platform' doesn't exist
if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

import App from "@/App";

registerRootComponent(App);
