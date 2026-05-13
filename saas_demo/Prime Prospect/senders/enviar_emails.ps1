# --- CONFIGURAÇÕES ---
$apiToken = "mssp.b8d8k8v.z3m5jgrwy6dldpyo.PsiMGPS"
$senderEmail = "contato@primetechonline.shop"
$senderName = "Jhoni | Prime Tech"

# --- FUNÇÃO DE ENVIO ---
function Send-MailerSendEmail {
    param (
        [string]$toEmail,
        [string]$toName,
        [string]$subject,
        [string]$htmlContent
    )

    $url = "https://api.mailersend.com/v1/email"
    
    $headers = @{
        "Authorization" = "Bearer $apiToken"
        "Content-Type"  = "application/json"
        "Accept"        = "application/json"
    }

    $body = @{
        "from" = @{
            "email" = $senderEmail
            "name"  = $senderName
        }
        "to" = @(
            @{
                "email" = $toEmail
                "name"  = $toName
            }
        )
        "subject" = $subject
        "html"    = $htmlContent
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
        return $true
    } catch {
        Write-Host "Erro ao enviar para $toEmail : $_" -ForegroundColor Red
        return $false
    }
}

# --- PROCESSAMENTO DO CSV ---
$csvPath = "leads_teste.csv"
if (-not (Test-Path $csvPath)) {
    Write-Host "Arquivo leads_teste.csv não encontrado!" -ForegroundColor Red
    exit
}

$leads = Import-Csv $csvPath

Write-Host "Iniciando disparos para $($leads.Count) contatos..." -ForegroundColor Cyan

foreach ($lead in $leads) {
    $nome = $lead.NOME
    $email = $lead.EMAIL
    
    Write-Host "Enviando para: $nome ($email)..." -NoNewline

    $html = @"
    <html>
    <body style='font-family: Arial, sans-serif;'>
        <p>Olá, <strong>$nome</strong>,</p>
        <p>Estava analisando o fluxo da sua clínica e notei um potencial de escala incrível.</p>
        <p>Sou o Jhoni, da Prime Tech, e criamos sistemas sob medida em 3 dias.</p>
        <p>Você teria 10 minutos para uma conversa técnica?</p>
        <p>Saiba mais em: <a href='https://primetechonline.shop'>primetechonline.shop</a></p>
        <br>
        <p>Abraço,<br><strong>Jhoni | Prime Tech</strong></p>
    </body>
    </html>
"@

    $success = Send-MailerSendEmail -toEmail $email -toName $nome -subject "Eficiência operacional na $nome" -htmlContent $html
    
    if ($success) {
        Write-Host " [OK]" -ForegroundColor Green
    }

    # Delay de 2 segundos para evitar bloqueios
    Start-Sleep -Seconds 2
}

Write-Host "`nProcesso concluído!" -ForegroundColor Yellow
pause
