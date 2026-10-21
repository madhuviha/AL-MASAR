import {vehicleAtlasSvg} from './vehicle-catalog.mjs';
export function mapVehicleSvg(category='Car',options={}){
  const supplied=vehicleAtlasSvg(category);if(supplied&&!options.statusColor)return supplied;
  const c=String(category||'Car').toLowerCase();

  if(c.includes('motor')||c.includes('scooter')){
    return `<svg class="map-vehicle-svg motorcycle" viewBox="0 0 30 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="8" r="6" fill="#1f2937"/>
      <circle cx="15" cy="52" r="6" fill="#1f2937"/>
      <rect x="11" y="14" width="8" height="32" rx="4" fill="currentColor"/>
      <rect x="7" y="23" width="16" height="5" rx="2" fill="#334155"/>
      <circle cx="15" cy="31" r="5" fill="#29465a"/>
    </svg>`;
  }

  if(c.includes('bus')){
    return `<svg class="map-vehicle-svg" viewBox="0 0 38 68" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="28" height="62" rx="7" fill="currentColor"/>
      <rect x="9" y="8" width="20" height="10" rx="2" fill="#29465a"/>
      <rect x="9" y="22" width="20" height="8" rx="2" fill="#3a5568"/>
      <rect x="9" y="34" width="20" height="8" rx="2" fill="#3a5568"/>
      <rect x="9" y="48" width="20" height="10" rx="2" fill="#29465a"/>
      <rect x="1" y="13" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="32" y="13" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="1" y="43" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="32" y="43" width="5" height="13" rx="2" fill="#1f2937"/>
    </svg>`;
  }

  if(c.includes('truck') || c.includes('tanker') || c.includes('heavy') || c.includes('trailer') || c.includes('flatbed') || c.includes('cement') || c.includes('crane')){
    return `<svg class="map-vehicle-svg" viewBox="0 0 42 72" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="3" width="26" height="25" rx="6" fill="currentColor"/>
      <rect x="11" y="7" width="20" height="9" rx="2" fill="#29465a"/>
      <rect x="5" y="31" width="32" height="37" rx="5" fill="currentColor"/>
      <rect x="1" y="10" width="7" height="12" rx="2" fill="#1f2937"/>
      <rect x="34" y="10" width="7" height="12" rx="2" fill="#1f2937"/>
      <rect x="1" y="43" width="7" height="15" rx="2" fill="#1f2937"/>
      <rect x="34" y="43" width="7" height="15" rx="2" fill="#1f2937"/>
      <path d="M11 35h20v28H11z" fill="#ffffff" opacity=".18"/>
    </svg>`;
  }

  if(c.includes('pickup')){
    return `<svg class="map-vehicle-svg" viewBox="0 0 36 66" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="3" width="24" height="58" rx="8" fill="currentColor"/>
      <rect x="9" y="10" width="18" height="12" rx="3" fill="#29465a"/>
      <rect x="9" y="28" width="18" height="25" rx="3" fill="#ffffff" opacity=".24"/>
      <rect x="2" y="12" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="29" y="12" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="2" y="42" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="29" y="42" width="5" height="13" rx="2" fill="#1f2937"/>
    </svg>`;
  }

  if(c.includes('van')||c.includes('ambulance')){
    return `<svg class="map-vehicle-svg" viewBox="0 0 36 66" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="26" height="60" rx="9" fill="currentColor"/>
      <rect x="8" y="9" width="20" height="13" rx="3" fill="#29465a"/>
      <rect x="8" y="28" width="20" height="20" rx="3" fill="#ffffff" opacity=".18"/>
      <rect x="8" y="51" width="20" height="7" rx="2" fill="#3a5568"/>
      <rect x="1" y="13" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="30" y="13" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="1" y="43" width="5" height="13" rx="2" fill="#1f2937"/>
      <rect x="30" y="43" width="5" height="13" rx="2" fill="#1f2937"/>
    </svg>`;
  }

  return `<svg class="map-vehicle-svg" viewBox="0 0 40 76" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="20" cy="39" rx="17" ry="34" fill="#0d1724" opacity=".18"/>
<g fill="#19232c"><rect x="3" y="17" width="5" height="12" rx="2"/><rect x="32" y="17" width="5" height="12" rx="2"/><rect x="3" y="51" width="5" height="12" rx="2"/><rect x="32" y="51" width="5" height="12" rx="2"/></g>
<path d="M9 7Q20 1 31 7L34 20V62Q33 71 27 73H13Q7 71 6 62V20Z" fill="currentColor" stroke="#24323f" stroke-width="1"/>
<path d="M9 12Q20 7 31 12L30 23H10Z" fill="#fff" opacity=".22"/>
<path d="M10 24Q20 19 30 24L28 34H12Z" fill="#213548" stroke="#93b1c0" stroke-width=".7"/>
<path d="M12 25L25 23 18 32H12Z" fill="#d9ecf5" opacity=".4"/>
<path d="M12 35H28V50H12Z" fill="currentColor"/>
<path d="M13 36H15V49H13Z" fill="#fff" opacity=".3"/>
<path d="M12 52H28L30 61Q20 64 10 61Z" fill="#253747" stroke="#91a8b9" stroke-width=".6"/>
<path d="M9 28L10 51 8 56V32Z M31 28L30 51 32 56V32Z" fill="#182f41"/>
<path d="M5 28H2V32H6 M35 28H38V32H34" fill="currentColor" stroke="#304252" stroke-width=".8"/>
<path d="M10 8L15 7 14 11 9 12Z M30 8L25 7 26 11 31 12Z" fill="#f2f7ef"/>
<path d="M10 68H15V70H10Z M25 68H30V70H25Z" fill="#af2833"/>
<path d="M15 5H25 M13 71H27" stroke="#cad2d9" stroke-width="1.5"/>
<path d="M8 14V24 M32 14V24 M10 64Q20 67 30 64" fill="none" stroke="#fff" opacity=".35"/>
</svg>`;
}
