-- =====================================================================
-- Radar · Etapa 2: agendador do robô (roda sozinho a cada 15 minutos)
-- Cada rodada verifica até 4 concorrentes que estão há 6 horas sem verificação.
-- Antes de rodar: a função "verificar" precisa estar publicada e o segredo
-- CRON_SECRET cadastrado com o MESMO valor que aparece abaixo.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- remove o agendamento antigo, se existir (pode rodar este script mais de uma vez)
select cron.unschedule(jobid) from cron.job where jobname = 'radar-verificar';

select cron.schedule(
  'radar-verificar',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://drsdfzetukwjflykouas.supabase.co/functions/v1/verificar',
    headers := '{"Content-Type":"application/json","x-cron-secret":"radar_oMi442_LqpT0IcsxKalIyOzbwCEHmtVo"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);

-- Para conferir: select * from cron.job;
-- Para ver as últimas execuções: select * from cron.job_run_details order by start_time desc limit 10;
