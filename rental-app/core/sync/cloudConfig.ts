// The rental app's OWN Supabase project ("Albunyan Rental") — separate from the
// old app's project. The key is the public anon key (it can't read anything on
// its own); data needs the device account's password, typed once per device.
export const cloud = {
  supabaseUrl: "https://dbzgiaxsxadzkfqppknm.supabase.co",
  supabaseKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiemdpYXhzeGFkemtmcXBwa25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDIyMjgsImV4cCI6MjEwODMxODIyOH0.GO54cbGOK61LUTM64kG4-HX6l8SpBGNegnpvIsqBDh0",
  email: "rental@elbonyan.app",
};
