import { createClient } from '@supabase/supabase-js';

// STEP 1: PLACEHOLDER CONSTANTS
export const SUPABASE_URL = 'https://wjyrinydwrazuzjczhbw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeXJpbnlkd3JhenV6amN6aGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTA3MTAsImV4cCI6MjA3OTA2NjcxMH0.lx5gKNPJLBfBouwH99MFFYHtjvxDZeohwoJr9JlSblg';
export const GEMINI_API_KEY = 'AIzaSyCfoI-xkUxf1vKEohEiyonxrV6iqGQatyY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
