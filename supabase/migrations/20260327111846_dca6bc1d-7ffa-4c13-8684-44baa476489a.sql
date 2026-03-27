
-- Table to store call signaling between peers
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  caller_id uuid NOT NULL,
  callee_id uuid,
  call_type text NOT NULL DEFAULT 'video',
  signal_type text NOT NULL,
  signal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Policies: room members can see/create signals
CREATE POLICY "Users see own call signals" ON public.call_signals
  FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "Users create call signals" ON public.call_signals
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Users update own call signals" ON public.call_signals
  FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "Users delete own call signals" ON public.call_signals
  FOR DELETE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Enable realtime for call signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
