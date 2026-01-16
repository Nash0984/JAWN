import { TenantSeal } from "./TenantSeal";
import { useTenant } from "@/contexts/TenantContext";

export function CountyHeader() {
  const { stateConfig } = useTenant();

  if (!stateConfig) {
    return null;
  }

  const headerText = `${stateConfig.stateName} Department of Human Services`;

  return (
    <div 
      className="flex items-center gap-3 px-4 py-2 border-b"
      style={{
        background: `linear-gradient(to right, color-mix(in srgb, var(--county-primary), transparent 90%), color-mix(in srgb, var(--county-secondary), transparent 90%))`,
        borderColor: `color-mix(in srgb, var(--county-primary), transparent 60%)`
      }}
      data-testid="header-state-branding"
    >
      <TenantSeal
        size="md"
        className="h-10 w-10" 
        data-testid="img-state-seal"
      />
      
      <div className="flex-1">
        <h1 
          className="text-lg font-semibold"
          style={{ color: `color-mix(in srgb, var(--county-primary), black 20%)` }}
          data-testid="text-state-name"
        >
          {headerText}
        </h1>
        <p 
          className="text-sm"
          style={{ color: `color-mix(in srgb, var(--county-primary), black 10%)` }}
          data-testid="text-state-welcome"
        >
          Welcome to {stateConfig.stateName} Benefits Navigator
        </p>
      </div>
    </div>
  );
}
