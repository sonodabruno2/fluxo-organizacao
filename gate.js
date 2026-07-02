// Portão de acesso "soft" — mesmo esquema do nexus-run/lumen-void.
// Só a senha abre; sem texto na tela, sem indicar tamanho.
//
// PARA REMOVER A SENHA: troque ACCESS_OPEN para `true`. O repo é público,
// então isto é apenas uma pequena barreira, não segurança real.

(() => {
  const ACCESS_OPEN = false;
  const ACCESS_HASH = "1f4afa679da7521ebf7f1ff54b7295e708c586e7247d0576e9e8e4e323eab041"; // sha256 da senha
  const ACCESS_KEY = "fluxo_access";

  if (ACCESS_OPEN) return;
  try { if (localStorage.getItem(ACCESS_KEY) === "1") return; } catch { /* ignora */ }

  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function mount() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0E0E10;display:flex;align-items:center;justify-content:center;";
    const style = document.createElement("style");
    style.textContent =
      ".gate-input{width:220px;padding:14px 18px;font-size:18px;letter-spacing:.2em;text-align:center;color:#F4F4F5;background:#1A1A1D;border:1px solid #2A2A2E;border-radius:14px;outline:none;font-family:ui-monospace,monospace;}" +
      ".gate-input.shake{animation:gate-shake .3s;}" +
      "@keyframes gate-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}";
    overlay.appendChild(style);
    const input = document.createElement("input");
    input.type = "password";
    input.className = "gate-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    overlay.appendChild(input);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 40);

    let busy = false;
    const check = async (force) => {
      if (busy) return;
      const v = input.value;
      if (v.length === 0) return;
      busy = true;
      const ok = (await sha256(v)) === ACCESS_HASH;
      busy = false;
      if (ok) {
        try { localStorage.setItem(ACCESS_KEY, "1"); } catch { /* ignora */ }
        overlay.remove();
      } else if (force || v.length >= 16) {
        // errou: limpa em silêncio (sem texto) + tremidinha
        input.value = "";
        input.classList.remove("shake");
        void input.offsetWidth; // reinicia a animação
        input.classList.add("shake");
      }
    };
    input.addEventListener("input", () => void check(false));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") void check(true); });
    overlay.addEventListener("mousedown", (e) => {
      if (e.target !== input) { e.preventDefault(); input.focus(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
