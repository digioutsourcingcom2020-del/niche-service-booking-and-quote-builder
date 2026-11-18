import { createContext, createResource, useContext } from 'solid-js';
import type { ParentProps, Resource } from 'solid-js';
import type { SettingsDto } from '@shared/types';
import { api } from './api';

interface StudioContextValue {
  settings: Resource<SettingsDto>;
  refetch: () => void;
}

const StudioContext = createContext<StudioContextValue>();

export function StudioProvider(props: ParentProps) {
  const [settings, { refetch }] = createResource(api.admin.settings);
  return <StudioContext.Provider value={{ settings, refetch }}>{props.children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used inside StudioProvider');
  return context;
}
