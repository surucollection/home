import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const staticFiles = [
  "about.html",
  "account.html",
  "admin.html",
  "contact.html",
  "login.html",
  "order.html",
  "product.html",
  "products.html",
  "register.html",
  "app.js",
  "styles.css"
];

function copyStaticSiteFiles() {
  return {
    name: "copy-static-site-files",
    closeBundle() {
      const root = process.cwd();
      const out = path.resolve(root, "dist");

      const copy = (src, dest) => {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src)) {
            copy(path.join(src, entry), path.join(dest, entry));
          }
          return;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      };

      for (const file of staticFiles) {
        copy(path.join(root, file), path.join(out, file));
      }

      copy(path.join(root, "assets"), path.join(out, "assets"));
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), copyStaticSiteFiles()],
  build: {
    sourcemap: false,
    emptyOutDir: true
  },
  server: {
    host: true
  },
  preview: {
    host: true
  }
});