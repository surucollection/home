import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function copyLegacy() {
  return {
    name: 'copy-legacy-site',
    closeBundle() {
      const root = process.cwd();
      const out = path.resolve(root, 'dist/legacy');
      fs.mkdirSync(out, { recursive: true });
      const copy = (src, dest) => {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      };
      for (const name of ['about.html','account.html','admin.html','contact.html','login.html','order.html','product.html','products.html','register.html','styles.css','app.js','assets','supabase']) {
        copy(path.join(root, name), path.join(out, name));
      }
    }
  };
}

export default defineConfig({
  plugins:[react(),copyLegacy()],
  server:{host:true},
  preview:{host:true}
});