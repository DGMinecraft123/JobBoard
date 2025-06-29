Write-Host "Testing translation speed..." -ForegroundColor Yellow

$start = Get-Date

try {
    $body = @{
        text = "This is a text that is being translated from English to French. Any words that are in English should be translated to French. Any words that are in French should be left alone. Any words that are in other languages should be translated to French. Any words that are in other languages should be left alone. Any words that are in other languages should be translated to French. Any words that are in other languages should be left alone."
        fromLanguage = "english"
        toLanguage = "french"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:8001/translate" -Method POST -Body $body -ContentType "application/json"
    
    $end = Get-Date
    $timeTaken = ($end - $start).TotalMilliseconds
    
    Write-Host "Translation successful!" -ForegroundColor Green
    Write-Host "Original text: $($response.originalText)" -ForegroundColor Cyan
    Write-Host "Translated text: $($response.translatedText)" -ForegroundColor Cyan
    Write-Host "Time taken: $([math]::Round($timeTaken))ms" -ForegroundColor Yellow
    
    if ($timeTaken -lt 1000) {
        Write-Host "Fast! Translation completed in under 1 second" -ForegroundColor Green
    } else {
        Write-Host "Slow: Translation took over 1 second" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure your FastAPI server is running on port 8001" -ForegroundColor Yellow
} 