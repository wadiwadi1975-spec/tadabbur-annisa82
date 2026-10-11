# توليد أصول الشعار من الملف الأصلي — يُشغَّل مرة عند تغيير الشعار
# المصدر: assets\logo-medallion-source.png (1254x1254)
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root 'assets\logo-medallion-source.png'
$img  = [System.Drawing.Image]::FromFile($src)

function New-Copy([int]$size, [double]$scale, [int]$r, [int]$g, [int]$b) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gr  = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gr.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gr.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gr.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $gr.Clear([System.Drawing.Color]::FromArgb(255, $r, $g, $b))
  $d = [int]([math]::Round($size * $scale))
  $o = [int](($size - $d) / 2)
  $gr.DrawImage($img, [System.Drawing.Rectangle]::new($o, $o, $d, $d))
  $gr.Dispose()
  return $bmp
}

function Save-PNG($bmp, [string]$rel) {
  $path = Join-Path $root $rel
  $dir  = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  if (Test-Path $path) { Remove-Item $path -Force }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# ---- 1) شعار القائمة الجانبية: خلفية شفافية تتلاشى على أي خلفية داكنة ----
$logo = New-Copy 340 1.0 10 9 6
$w = $logo.Width; $h = $logo.Height
$changed = 0
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $logo.GetPixel($x, $y)
    $lum = ($c.R * 0.3) + ($c.G * 0.6) + ($c.B * 0.1)
    $a = ($lum - 9.0) / 0.55
    if ($a -lt 0) { $a = 0 } elseif ($a -gt 255) { $a = 255 }
    $a = [int][math]::Round($a)
    if ($a -ne 255) {
      $logo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B))
      $changed++
    }
  }
}
Save-PNG $logo 'public\img\logo.png'
Write-Output ("logo pixels with alpha < 255: {0}" -f $changed)

# ---- 2) أيقونات التطبيق: خلفية سوداء معتمة مطابقة لخلفية الشعار ----
Save-PNG (New-Copy 192 1.0 10 9 6)  'public\icon-192.png'
Save-PNG (New-Copy 512 1.0 10 9 6)  'public\icon-512.png'
Save-PNG (New-Copy 180 1.0 10 9 6)  'public\apple-touch-icon.png'
# أيقونة قابلة للقناعة (maskable): مصغّرة داخل المنطقة الآمنة حتى لا يقصّها القناع الدائري
Save-PNG (New-Copy 512 0.70 10 9 6) 'public\icon-maskable-512.png'

$img.Dispose()

foreach ($f in @('public\img\logo.png', 'public\icon-192.png', 'public\icon-512.png',
                 'public\apple-touch-icon.png', 'public\icon-maskable-512.png')) {
  $p  = Join-Path $root $f
  $bi = [System.Drawing.Image]::FromFile($p)
  '{0,-32} {1}x{2}  {3} KB' -f $f, $bi.Width, $bi.Height, [math]::Round((Get-Item $p).Length / 1KB)
  $bi.Dispose()
}
