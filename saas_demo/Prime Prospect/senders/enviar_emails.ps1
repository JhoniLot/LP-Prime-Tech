# Prime Tech - Robô de Prospecção Sincronizado
# Este script lê ordens de envio do Dashboard e executa via MailerSend

$SUPABASE_URL = "https://zseqxonektcdrphtxfcn.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzZXF4b25la3RjZHJwaHR4ZmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODA1NTUsImV4cCI6MjA5NDI1NjU1NX0.8FXsU2GiM6Owm6Hl0CrRY-FG0xi5JmmvmDsts7B3JuU"
$MAILERSEND_TOKEN = "mssp.b8d8k8v.z3m5jgrwy6dldpyo.PsiMGPS"

Write-Host "--- PRIME TECH COMMAND CENTER ---" -ForegroundColor Cyan
Write-Host "Procurando campanhas preparadas no site..." -ForegroundColor Yellow

# 1. Buscar a Campanha mais recente que esteja "Pronta"
$headers = @{ "apikey" = $SUPABASE_KEY; "Authorization" = "Bearer $SUPABASE_KEY" }
$campUrl = "$SUPABASE_URL/rest/v1/campaigns?status=eq.Pronta&select=*,lists(nome)"

try {
    $campaigns = Invoke-RestMethod -Uri $campUrl -Method Get -Headers $headers
} catch {
    Write-Host "Erro ao conectar: $_" -ForegroundColor Red
    return
}

if ($null -eq $campaigns -or $campaigns.Count -eq 0) {
    Write-Host "Nenhuma campanha pendente. Vá ao site e clique em 'Disparar' primeiro!" -ForegroundColor Green
    return
}

$camp = $campaigns[0] # Pega a primeira da fila
$assunto = $camp.assunto
$mensagem = $camp.mensagem
$listId = $camp.list_id

Write-Host "`nCampanha Encontrada!" -ForegroundColor Green
Write-Host "Assunto: $assunto"
Write-Host "Destino: Lista ID $listId"

# 2. Buscar Leads dessa lista específica
Write-Host "Buscando leads da lista..." -ForegroundColor Yellow
$leadsUrl = "$SUPABASE_URL/rest/v1/leads?list_id=eq.$listId&select=*"
$leads = Invoke-RestMethod -Uri $leadsUrl -Method Get -Headers $headers

if ($leads.Count -eq 0) {
    Write-Host "A lista selecionada está vazia!" -ForegroundColor Red
    return
}

$confirm = Read-Host "`nDeseja iniciar o disparo para $($leads.Count) leads agora? (S/N)"
if ($confirm -ne "S") { return }

# 3. Disparar
foreach ($lead in $leads) {
    $email = $lead.email
    $nome = $lead.nome
    
    Write-Host "Enviando para: $email..." -ForegroundColor White
    
    # Personalizar Tags
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
        Write-Host "DICA: Verifique se o seu Token na MailerSend está ativo e se o domínio primetechonline.shop está verificado lá!" -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds 1 # Delay anti-spam
}

# 4. Marcar Campanha como Enviada
$updateUrl = "$SUPABASE_URL/rest/v1/campaigns?id=eq.$($camp.id)"
$updateBody = @{ "status" = "Enviada" } | ConvertTo-Json
Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $headers -Body $updateBody -ContentType "application/json"

Write-Host "`n--- TUDO ENVIADO COM SUCESSO! ---" -ForegroundColor Cyan
