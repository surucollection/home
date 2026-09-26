import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const htmlEntries = [
  "index.html",
  "about.html",
  "account.html",
  "account/index.html",
  "orders.html",
  "orders/index.html",
  "admin.html",
  "contact.html",
  "login.html",
  "order.html",
  "product.html",
  "products.html",
  "register.html"
];

function copyRuntimeFiles() {
  return {
    name: "copy-runtime-files",
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

      copy(path.join(root, "styles.css"), path.join(out, "styles.css"));
      copy(path.join(root, "assets"), path.join(out, "assets"));
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), copyRuntimeFiles()],
  build: {
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        htmlEntries.map((file) => [file.replace(".html", ""), path.resolve(process.cwd(), file)])
      )
    }
  },
  server: {
    host: true
  },
  preview: {
    host: true
  }
});
