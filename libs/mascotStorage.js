
import { supabase } from './supabase';
import { buildMascotSvg } from './mascot';

export async function uploadMascot(userId, botId, config) {
  const svg = buildMascotSvg(config, 512);
  const path = `${userId}/${botId}.svg`;
  const body = new TextEncoder().encode(svg);

  const { error } = await supabase.storage.from('mascots').upload(path, body, {
    contentType: 'image/svg+xml',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from('mascots').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}