import { createContext, createResource, useContext } from 'solid-js';
import type { ParentProps, Resource } from 'solid-js';
import type { PublicProfile } from '@shared/types';
import { api } from './api';

const SiteContext = createContext<Resource<PublicProfile>>();

export function SiteProvider(props: ParentProps) {
  const [profile] = createResource(api.profile);
  return <SiteContext.Provider value={profile}>{props.children}</SiteContext.Provider>;
}

export function useSite(): Resource<PublicProfile> {
  const context = useContext(SiteContext);
  if (!context) throw new Error('useSite must be used inside SiteProvider');
  return context;
}
