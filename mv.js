// Balan\u00e7o UTI \u2014 script carregado pelo favorito "\u1f4e4 Balan\u00e7o UTI" dentro do MV.
//
// O relat\u00f3rio Jasper do MV \u00e9 gerado uma \u00fanica vez por pedido: buscar a URL de
// novo devolve 0 bytes. Por isso o favorito funciona em dois modos:
//  - Na aba do PDF: tenta ler a c\u00f3pia em cache. Se n\u00e3o houver, orienta a usar
//    o modo captura.
//  - Na tela do MV (modo captura): intercepta o pedido que gera o PDF
//    (window.open, envio de formul\u00e1rio, XHR/fetch), faz o pr\u00f3prio pedido,
//    envia o PDF para o site e mostra o PDF numa aba, como o MV faria.
//    Fica armado at\u00e9 a p\u00e1gina do MV ser recarregada.
// Compat\u00edvel com Chromium 86 (Cent Browser 4.3): sem ?. nem ??.
(function(){
  "use strict";
  var SITE = "https://lpires9.github.io/balanco-uti/";
  var ORIGIN = "https://lpires9.github.io";
  var TAG = "[Balan\u00e7o UTI] ";
  var REPORT_RE = /jasper|\.pdf(\?|#|$)/i;
  var top_ = window;
  var log = (top_.__balancoUTILog = top_.__balancoUTILog || []);
  function note(s){ log.push(new Date().toTimeString().slice(0,8) + " " + s); if(log.length > 60) log.shift(); }

  function siteWin(){
    var w = top_.__balancoUTIwin;
    if(!w || w.closed){
      w = top_.open(SITE + "#receber", "balanco_uti");
      top_.__balancoUTIwin = w;
    }
    return w;
  }

  function isPdf(buf){
    if(!buf || buf.byteLength < 5) return false;
    var b = new Uint8Array(buf, 0, 5);
    return String.fromCharCode(b[0],b[1],b[2],b[3],b[4]) === "%PDF-";
  }

  // Sends the PDF to the site tab, repeating until it acknowledges.
  function send(buf, name){
    var w = siteWin();
    if(!w){ alert(TAG + "O navegador bloqueou a janela do site. Permita pop-ups para " + location.host + "."); return; }
    var id = Date.now() + "_" + Math.random(), ok = false, n = 0;
    function onMsg(e){ if(e.data && e.data.type === "balanco-recebido" && e.data.id === id) ok = true; }
    top_.addEventListener("message", onMsg);
    var t = setInterval(function(){
      if(ok || n++ > 40){
        clearInterval(t); top_.removeEventListener("message", onMsg);
        if(ok) note("PDF enviado ao site (" + buf.byteLength + " bytes)");
        else alert(TAG + "O PDF foi capturado (" + buf.byteLength + " bytes), mas a p\u00e1gina do balan\u00e7o n\u00e3o respondeu. Verifique se ela abriu.");
        return;
      }
      try{ w.postMessage({type:"balanco-pdf", id:id, name:name || "balanco.pdf", buf:buf}, ORIGIN); }catch(err){}
    }, 500);
  }

  function showPdfIn(w, buf){
    if(!w) return;
    try{ w.location.href = URL.createObjectURL(new Blob([buf], {type:"application/pdf"})); }catch(e){ note("n\u00e3o consegui mostrar o PDF: " + e.message); }
  }

  // Fetches the report ourselves, then sends it and shows it in `w`.
  function grab(win, url, init, w){
    note("pedido do relat\u00f3rio: " + ((init && init.method) || "GET") + " " + url);
    (win.__buFetch || win.fetch).call(win, url, Object.assign({credentials:"include"}, init || {}))
      .then(function(r){ return r.arrayBuffer().then(function(b){ return {r:r, b:b}; }); })
      .then(function(x){
        if(isPdf(x.b)){ send(x.b); showPdfIn(w, x.b); }
        else {
          note("resposta n\u00e3o-PDF: HTTP " + x.r.status + ", " + x.b.byteLength + " bytes");
          alert(TAG + "Capturei o pedido do relat\u00f3rio, mas a resposta n\u00e3o foi um PDF (HTTP " + x.r.status + ", " + x.b.byteLength + " bytes). Clique no favorito de novo para ver o diagn\u00f3stico.");
          if(w) try{ w.location.href = url; }catch(e){}
        }
      })
      .catch(function(e){ note("erro ao buscar: " + e.message); alert(TAG + "Erro ao buscar o relat\u00f3rio: " + e.message); });
  }

  function absUrl(win, u){ try{ return new win.URL(u, win.location.href).href; }catch(e){ return String(u); } }

  // ---------- hooks (installed in the top window and every same-origin frame) ----------
  function short(u){ u = String(u || ""); u = u.replace(/^https?:\/\/[^\/]+/, ""); return u.length > 70 ? u.slice(0,70) + "\u2026" : u; }
  function safe(name, fn){ try{ fn(); }catch(e){ note("ERRO ao instalar " + name + ": " + e.message); } }

  function hook(win){
    try{ if(!win || win.__balancoUTIHooked) return; win.__balancoUTIHooked = true; }catch(e){ return; }
    top_.__balancoUTIn = (top_.__balancoUTIn || 0) + 1;
    if(win !== top_) note("quadro monitorado: " + short(win.location.href));

    // 1) window.open(reportUrl)
    var origOpen = win.open;
    safe("open", function(){ win.open = function(url, name, feat){
      var u = url ? absUrl(win, url) : "";
      note("window.open(" + short(u || "''") + ", " + (name || "") + ")");
      if(u && REPORT_RE.test(u) && !/^blob:/.test(u)){
        var w = origOpen.call(win, "about:blank", name || "_blank", feat);
        grab(win, u, null, w);
        return w;
      }
      return origOpen.apply(win, arguments);
    }; });

    // 2) form submission to the report
    function formInit(form){
      var method = (form.getAttribute("method") || "GET").toUpperCase();
      var fd = new win.FormData(form);
      if(method === "GET"){
        var q = new win.URLSearchParams(fd).toString();
        var a = absUrl(win, form.getAttribute("action") || win.location.href);
        return {url: a + (q ? (a.indexOf("?") >= 0 ? "&" : "?") + q : ""), init:{method:"GET"}};
      }
      var enc = (form.getAttribute("enctype") || "").toLowerCase();
      return {url: absUrl(win, form.getAttribute("action") || win.location.href),
              init:{method:method, body: enc.indexOf("multipart") >= 0 ? fd : new win.URLSearchParams(fd)}};
    }
    function handleForm(form){
      var action = absUrl(win, form.getAttribute("action") || "");
      note("form " + (form.getAttribute("method") || "GET").toUpperCase() + " " + short(action) + " alvo=" + (form.getAttribute("target") || ""));
      if(!REPORT_RE.test(action)) return false;
      var x = formInit(form);
      var target = form.getAttribute("target");
      var w = (target && target !== "_self") ? origOpen.call(win, "about:blank", target) : null;
      grab(win, x.url, x.init, w);
      return true;
    }
    safe("form", function(){
      var FP = win.HTMLFormElement.prototype, origSubmit = FP.submit, origReq = FP.requestSubmit;
      FP.submit = function(){ if(handleForm(this)) return; return origSubmit.apply(this, arguments); };
      if(origReq) FP.requestSubmit = function(){ if(handleForm(this)) return; return origReq.apply(this, arguments); };
      win.document.addEventListener("submit", function(e){ if(handleForm(e.target)) e.preventDefault(); }, true);
    });

    // links (<a href=... target=_blank>, inclusive a.click() programatico)
    function handleLink(a, ev){
      var href = a.href || "";
      var tgt = a.getAttribute("target") || "";
      if(tgt || REPORT_RE.test(href)) note("link " + short(href) + " alvo=" + tgt);
      if(!REPORT_RE.test(href) || /^blob:/.test(href)) return false;
      if(ev) ev.preventDefault();
      var w = origOpen.call(win, "about:blank", tgt && tgt !== "_self" ? tgt : "_blank");
      grab(win, href, null, w);
      return true;
    }
    safe("link", function(){
      var AP = win.HTMLAnchorElement.prototype, origClick = AP.click;
      AP.click = function(){ if(handleLink(this, null)) return; return origClick.apply(this, arguments); };
      win.document.addEventListener("click", function(e){
        var el = e.target;
        while(el && el.nodeName !== "A") el = el.parentNode;
        if(el && el.nodeName === "A") handleLink(el, e);
      }, true);
    });

    // 3) passive: XHR / fetch that already return the PDF (nothing is re-requested)
    safe("xhr", function(){
    var XO = win.XMLHttpRequest.prototype.open, XS = win.XMLHttpRequest.prototype.send;
    win.XMLHttpRequest.prototype.open = function(m, u){ this.__bu = absUrl(win, u); this.__bm = m; return XO.apply(this, arguments); };
    win.XMLHttpRequest.prototype.send = function(){
      var xhr = this;
      if(xhr.__bu && !/\.(js|css|html|png|gif|svg|woff2?)(\?|$)/i.test(xhr.__bu)) note("XHR " + (xhr.__bm || "") + " " + short(xhr.__bu));
      if(xhr.__bu && REPORT_RE.test(xhr.__bu)){
        note("XHR do relat\u00f3rio: " + xhr.__bu);
        xhr.addEventListener("load", function(){
          var r = xhr.response, p;
          if(r instanceof ArrayBuffer) p = Promise.resolve(r);
          else if(r instanceof Blob) p = r.arrayBuffer();
          if(p) p.then(function(b){ if(isPdf(b)) send(b.slice(0)); });
        });
      }
      return XS.apply(this, arguments);
    };
    });
    if(win.fetch) safe("fetch", function(){
      var F = win.__buFetch = win.fetch;
      win.fetch = function(input, init){
        var u = absUrl(win, (input && input.url) || input);
        var pr = F.apply(this, arguments);
        note("fetch " + short(u));
        if(REPORT_RE.test(u)){
          pr.then(function(r){ return r.clone().arrayBuffer(); }).then(function(b){ if(isPdf(b)) send(b); }).catch(function(){});
        }
        return pr;
      };
    });
  }

  function hookAll(win){
    hook(win);
    try{
      for(var i = 0; i < win.frames.length; i++){
        try{ void win.frames[i].document; hookAll(win.frames[i]); }catch(e){ /* cross-origin frame */ }
      }
    }catch(e){}
  }

  // ---------- entry ----------
  if(document.contentType === "application/pdf"){
    // PDF tab: the report can't be re-requested; try the browser cache once.
    fetch(location.href, {credentials:"include", cache:"force-cache"})
      .then(function(r){ return r.arrayBuffer(); })
      .then(function(b){
        if(isPdf(b)) send(b);
        else alert(TAG + "O MV n\u00e3o deixa buscar este PDF de novo (" + b.byteLength + " bytes).\n\nUse assim: na TELA DO MV, antes de abrir o balan\u00e7o, clique no favorito. Ele fica armado e envia cada balan\u00e7o que voc\u00ea abrir.");
      })
      .catch(function(e){ alert(TAG + "Erro ao ler o PDF: " + e.message); });
    return;
  }

  // Lista todos os quadros (iframe/frame/embed/object), inclusive de outra
  // origem, para descobrir onde a tela do MV realmente roda.
  function frameReport(){
    var out = [];
    function walk(win, depth){
      var doc;
      try{ doc = win.document; }catch(e){ return; }
      var els = doc.querySelectorAll("iframe,frame,embed,object");
      for(var i = 0; i < els.length && out.length < 12; i++){
        var el = els[i], src = el.src || el.data || el.getAttribute("src") || "(sem src)";
        var acc = "outra origem";
        try{ if(el.contentWindow){ void el.contentWindow.document.body; acc = "mesma origem"; } }catch(e){}
        out.push(new Array(depth+1).join("  ") + el.nodeName.toLowerCase() + " [" + acc + "] " + String(src).slice(0,90));
        try{ if(el.contentWindow && acc === "mesma origem") walk(el.contentWindow, depth+1); }catch(e){}
      }
    }
    walk(top_, 0);
    return out.length ? out.join("\n") : "(nenhum quadro na p\u00e1gina)";
  }

  if(top_.__balancoUTIArmed){
    alert(TAG + "Captura j\u00e1 est\u00e1 ARMADA nesta tela do MV. Abra o balan\u00e7o normalmente.\n\nDiagn\u00f3stico (" + (top_.__balancoUTIn || 0) + " janela/quadros monitorados; \u00faltimos eventos):\n" + (log.length ? log.slice(-12).join("\n") : "nada registrado") + "\n\nQuadros da p\u00e1gina:\n" + frameReport() + "\nEndere\u00e7o: " + location.href.slice(0,100));
    hookAll(top_);
    return;
  }
  top_.__balancoUTIArmed = true;
  hookAll(top_);
  // Frames the MV loads later (menus, telas) are hooked as they appear.
  setInterval(function(){ hookAll(top_); }, 1000);
  note("captura armada em " + location.href);
  alert(TAG + "Captura ARMADA. Agora abra o balan\u00e7o no MV normalmente: o PDF vai direto para o site.\n(Fica ativo at\u00e9 recarregar esta tela.)");
})();
