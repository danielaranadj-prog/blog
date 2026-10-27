import"./chunks/SiteRuntime.astro_astro_type_script_index_0_lang.39496503.js";const i="instante-saved-route-v1",a=document.getElementById("savedRouteGrid"),n=document.getElementById("emptyRouteState");function s(){try{const t=localStorage.getItem(i);return t?JSON.parse(t):[]}catch{return[]}}function c(){const t=s(),d=document.getElementById("headerRouteCount");if(d&&(d.textContent=String(t.length)),!(!a||!n)){if(t.length===0){n.hidden=!1,a.hidden=!0,a.innerHTML="";return}n.hidden=!0,a.hidden=!1,a.innerHTML=t.map((e,r)=>`
          <article class="saved-guide-card">
            <div>
              <span class="saved-cat-pill">\u2705 DISPONIBLE OFFLINE \xB7 ${(e.category||"VIAJES").toUpperCase()}</span>
              <h3><a href="${e.url}">${e.title}</a></h3>
            </div>
            <div class="saved-card-actions">
              <a href="${e.url}" class="read-saved-btn">Abrir gu\xEDa \u2192</a>
              <button type="button" class="remove-saved-btn" data-remove-idx="${r}" aria-label="Quitar de Mi Ruta">Quitar \u2715</button>
            </div>
          </article>
        `).join(""),a.querySelectorAll("[data-remove-idx]").forEach(e=>{e.addEventListener("click",()=>{const r=Number(e.dataset.removeIdx),o=s();o.splice(r,1);try{localStorage.setItem(i,JSON.stringify(o))}catch{}c()})})}}c();
