# Prime Tech - Robô de Prospecção Sincronizado
# Este script lê ordens de envio e o Token do Dashboard via Supabase

$SUPABASE_URL = "https://zseqxonektcdrphtxfcn.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZXF4b25la3RjZHJwaHR4ZmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODA1NTUsImV4cCI6MjA5NDI1NjU1NX0.8FXsU2GiM6Owm6Hl0CrRY-FG0xi5JmmvmDsts7B3JuU"

Write-Host "--- PRIME TECH COMMAND CENTER ---" -ForegroundColor Cyan
Write-Host "Iniciando sincronização com o banco de dados..." -ForegroundColor Yellow

# 1. Buscar Token da MailerSend nas configurações
$headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }
try {
    $settings = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/settings?id=eq.mailersend_token&select=value" -Method Get -Headers $headers
    $MAILERSEND_TOKEN = $settings[0].value
    if (!$MAILERSEND_TOKEN) { throw "Token não encontrado no banco." }
} catch {
    Write-Host "Aviso: Token não encontrado no banco. Usando valor padrão." -ForegroundColor Gray
    $MAILERSEND_TOKEN = "mlsn.10343a487aa88400078d886c85e208f67172609bda003130151a45717805213d"
}

# 2. Buscar a Campanha mais recente que esteja "Pronta"
Write-Host "Procurando campanhas preparadas no site..." -ForegroundColor Yellow
$campUrl = "$SUPABASE_URL/rest/v1/campaigns?status=eq.Pronta&select=*"
try {
    $campaigns = Invoke-RestMethod -Uri $campUrl -Method Get -Headers $headers
} catch {
    Write-Host "Erro ao conectar ao Supabase: $_" -ForegroundColor Red
    return
}

if ($null -eq $campaigns -or $campaigns.Count -eq 0) {
    Write-Host "Nenhuma campanha pendente no site!" -ForegroundColor Green
    return
}

$camp = $campaigns[0]
$assunto = $camp.assunto
$mensagem = $camp.mensagem
$listId = $camp.list_id

Write-Host "`nCampanha Encontrada!" -ForegroundColor Green
Write-Host "Assunto: $assunto"

# 3. Buscar Leads
Write-Host "Buscando leads da lista..." -ForegroundColor Yellow
$leadsUrl = "$SUPABASE_URL/rest/v1/leads?list_id=eq.$listId&select=*"
$leads = Invoke-RestMethod -Uri $leadsUrl -Method Get -Headers $headers

if ($leads.Count -eq 0) {
    Write-Host "A lista selecionada está vazia!" -ForegroundColor Red
    return
}

$confirm = Read-Host "`nDeseja iniciar o disparo para $($leads.Count) leads agora? (S/N)"
if ($confirm -ne "S") { return }

# 4. Disparar
foreach ($lead in $leads) {
    $email = $lead.email
    $nome = $lead.nome
    Write-Host "Enviando para: $email..." -ForegroundColor White
    
    $finalSubject = $assunto.Replace("{{ NOME }}", $nome)
    $finalBody = $mensagem.Replace("{{ NOME }}", $nome)

    $mailBody = @{
        "from" = @{ "email" = "contato@primetechonline.shop"; "name" = "Prime Tech" }
        "to" = @( @{ "email" = $email; "name" = $nome } )
        "subject" = $finalSubject
        "html" = $finalBody
    } | ConvertTo-Json -Depth 10 -Compress

    try {
        $apiHeaders = @{ 
            "Authorization" = "Bearer $MAILERSEND_TOKEN"
            "Content-Type" = "application/json"
            "X-Requested-With" = "XMLHttpRequest"
        }
        Invoke-WebRequest -Uri "https://api.mailersend.com/v1/email" `
            -Method Post `
            -Headers $apiHeaders `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($mailBody))
        Write-Host "Sucesso: $email" -ForegroundColor Green
    } catch {
        Write-Host "Erro em $($email): $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 1
}

# 5. Finalizar
$updateUrl = "$SUPABASE_URL/rest/v1/campaigns?id=eq.$($camp.id)"
$updateBody = @{ "status" = "Enviada" } | ConvertTo-Json
Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $headers -Body $updateBody -ContentType "application/json"

Write-Host "`n--- DISPARO CONCLUÍDO! ---" -ForegroundColor Cyan
