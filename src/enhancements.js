(() => {
  const init = () => {
    document.documentElement.classList.add("premium-ai-ui");
    const site = document.querySelector(".site");
    if (!site || site.dataset.enhanced) return;
    site.dataset.enhanced = "true";

    const bg = document.createElement("div");
    bg.className = "ai-ambient";
    bg.setAttribute("aria-hidden","true");
    bg.innerHTML = '<span class="orb orb-a"></span><span class="orb orb-b"></span><span class="orb orb-c"></span><span class="particle-field"></span><span class="ai-grid"></span>';
    site.prepend(bg);

    const toggle = document.createElement("button");
    toggle.className = "themeToggle magnetic";
    toggle.type = "button";
    toggle.setAttribute("aria-label","Toggle theme");
    toggle.innerHTML = "☼";
    document.querySelector(".nav")?.appendChild(toggle);
    const saved = localStorage.getItem("ai_theme");
    if (saved === "light") document.documentElement.classList.add("light");
    toggle.onclick = () => {
      document.documentElement.classList.toggle("light");
      localStorage.setItem("ai_theme", document.documentElement.classList.contains("light") ? "light" : "dark");
    };

    const reveal = () => {
      document.querySelectorAll(".hero, .section, .feature, .featureCard, .card, .pricingCard, .workspace, .tool, .result, .about, .contact, .authCard, .quizCard").forEach(el => {
        el.classList.add("scrollReveal");
        if (!el.dataset.revealBound) {
          el.dataset.revealBound = "1";
          observer.observe(el);
        }
      });
    };
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("isVisible"); observer.unobserve(e.target); }
    }), {threshold:.08});
    reveal();

    document.querySelectorAll("button, .card, .featureCard, .pricingCard, .tool, .result, .logo").forEach(el => {
      el.classList.add("microInteractive");
      el.addEventListener("pointermove", e => {
        if (window.matchMedia("(pointer:fine)").matches && el.classList.contains("magnetic")) {
          const r=el.getBoundingClientRect(), x=(e.clientX-r.left-r.width/2)*.12, y=(e.clientY-r.top-r.height/2)*.12;
          el.style.transform="translate3d("+x+"px,"+y+"px,0)";
        }
      });
      el.addEventListener("pointerleave", () => { if (el.classList.contains("magnetic")) el.style.transform=""; });
    });
    document.querySelectorAll("button.primary, button.primary.wide, .navCta").forEach(b => b.classList.add("magnetic"));

    const onScroll = () => document.querySelector(".nav")?.classList.toggle("navScrolled", scrollY > 18);
    addEventListener("scroll", onScroll, {passive:true}); onScroll(); reveal();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();