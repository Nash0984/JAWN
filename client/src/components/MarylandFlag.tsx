export const MarylandFlag = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 600 400" 
    className={className}
    aria-label="Maryland State Flag"
  >
    <rect width="600" height="400" fill="#231F20"/>
    <rect x="0" y="0" width="300" height="200" fill="#ffc838"/>
    <rect x="300" y="0" width="300" height="200" fill="#231F20"/>
    <rect x="0" y="200" width="300" height="200" fill="#231F20"/>
    <rect x="300" y="200" width="300" height="200" fill="#ffc838"/>
    <path d="M0,0 L60,40 L0,80 Z" fill="#c8122c"/>
    <path d="M60,0 L120,40 L60,80 Z" fill="#c8122c"/>
    <path d="M120,0 L180,40 L120,80 Z" fill="#c8122c"/>
    <path d="M180,0 L240,40 L180,80 Z" fill="#c8122c"/>
    <path d="M240,0 L300,40 L240,80 Z" fill="#c8122c"/>
  </svg>
);
