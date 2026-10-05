# Suru Image Processor for iPhone

On-device worker for Suru Collection. Google Drive originals -> Supabase queue -> iPhone AI processing -> authenticated Supabase worker -> Google Drive Processed -> website.

Target: iOS 27+, iPhone 17-class hardware or newer, SwiftUI, Core AI.

Security: the app uses only the Supabase publishable/anon key plus the signed-in admin/manager session. Never put the Supabase service-role key or Google service-account private key in the app.

Backend worker: google-drive-image-worker. Actions: claim, complete, fail.

AI plan: Moebius for inpainting/object removal, then Real-ESRGAN only when quality checks say enhancement is needed. Moebius upstream states that its code and pretrained weights are Apache-2.0 and commercially usable. The original LaMa release is non-commercial, so it is not used.

Apple Core AI runs inference on-device, so there is no per-inference API fee. Core AI targets iOS 27 and Apple silicon.

The model asset is deliberately not bundled until its exact checkpoint/provenance is verified. This avoids silently shipping an ambiguous model license.

Create an iOS App in Xcode 27 named Suru Image Processor, add the Swift files in this folder, then add the verified Moebius Core AI asset.