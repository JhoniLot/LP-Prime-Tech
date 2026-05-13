# Prime Tech - Robô de Prospecção Híbrido
# Este script conecta o Supabase ao MailerSend

$SUPABASE_URL = "https://zseqxonektcdrphtxfcn.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZXF4b25la3RjZHJwaHR4ZmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODA1NTUsImV4cCI6MjA5NDI1NjU1NX0.8FXsU2GiM6Owm6Hl0CrRY-FG0xi5JmmvmDsts7B3JuU"
$MAILERSEND_TOKEN = "mssp.b8d8k8v.z3m5jgrwy6dldpyo.PsiMGPS"

Write-Host "--- PRIME TECH COMMAND CENTER ---" -ForegroundColor Cyan
Write-Host "Buscando novos leads no Supabase..." -ForegroundColor Yellow

# 1. Buscar Leads Pendentes
$headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }
$leadsUrl = "$SUPABASE_URL/rest/v1/leads?status=eq.Pendente&select=*"

try {
    $leads = Invoke-RestMethod -Uri $leadsUrl -Method Get -Headers $headers
} catch {
    Write-Host "Erro ao conectar ao Supabase: $_" -ForegroundColor Red
    return
}

if ($leads.Count -eq 0 -or $null -eq $leads) {
    Write-Host "Nenhum lead pendente encontrado. Tudo em dia!" -ForegroundColor Green
    return
}

Write-Host "Encontrados $($leads.Count) leads para envio. Iniciando..." -ForegroundColor Cyan

# 2. Loop de Envio
foreach ($lead in $leads) {
    $email = $lead.email
    $nome = $lead.nome
    
    Write-Host "Enviando para: $email..." -ForegroundColor White
    
    # Corpo do E-mail (HTML)
    $htmlBody = @"
    <div style='font-family: sans-serif; line-height: 1.6; color: #333;'>
        <h2>Olá, $nome!</h2>
        <p>Vi que sua clínica de estética está em expansão e gostaria de apresentar a <strong>Prime Tech</strong>.</p>
        <p>Automatizamos processos para que você foque no que importa: seus pacientes.</p>
        <br>
        <p>Podemos agendar uma conversa de 5 minutos?</p>
        <p>Atenciosamente,<br><strong>Jhoni - Prime Tech</strong></p>
    </div>
"@

    $mailBody = @{
        "from" = @{ "email" = "contato@primetechonline.shop"; "name" = "Prime Tech" }
        "to" = @( @{ "email" = $email; "name" = $nome } )
        "subject" = "Oportunidade para a sua Clínica, $nome"
        "html" = $htmlBody
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-WebRequest -Uri "https://api.mailersend.com/v1/email" `
            -Method Post `
            -Headers @{ "Authorization" = "Bearer $MAILERSEND_TOKEN"; "Content-Type" = "application/json" } `
            -Body $mailBody
        
        if ($response.StatusCode -eq 202) {
            Write-Host "Sucesso: $email" -ForegroundColor Green
            
            # 3. Atualizar Status no Supabase
            $updateUrl = "$SUPABASE_URL/rest/v1/leads?id=eq.$($lead.id)"
            $updateBody = @{ "status" = "Enviado" } | ConvertTo-Json
            Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $headers -Body $updateBody -ContentType "application/json"
        }
    } catch {
        Write-Host "Falha ao enviar para $email: $_" -ForegroundColor Red
    }
    
    # Pausa de 2 segundos para evitar spam
    Start-Sleep -Seconds 2
}

Write-Host "--- DISPARO CONCLUÍDO ---" -ForegroundColor Cyan
