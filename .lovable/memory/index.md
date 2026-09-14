# Project Memory

## Core
US Gymnasium brand, Vibrant Blue & Cyan theme, hide scrollbars globally (`scrollbar-hide`). No pricing on homepage.
React PWA + Vite frontend. Backend = local Express + SQLite + Nodemailer (Gmail SMTP) in `/server`. Deploy backend separately (Render/Railway) and set `VITE_API_URL` for hosted use.
Admin route `/` uses TWO logins: gate (gymnasium / GYMNASIUM_1521, frontend) then admin (usgymnasium / usbv@7173, server JWT). `/register` is public.
Communication via email (Nodemailer). SMS endpoints kept named `/api/sms/*` for backwards compat but they send EMAIL.

## Memories
- [Two-Step Login](mem://auth/two-step-login-credentials) — Gate + admin login credentials and storage keys
- [Scanner Checkin](mem://client-access/scanner-checkin) — Client dashboard accessed via QR scanner showing membership status
- [Client ID Gen](mem://admin/client-id-generation) — Auto-generates starting at 101, hidden from clients
- [Pricing Removal](mem://ui/homepage-pricing-removal) — Homepage landing should not display pricing amounts
- [T&C Constraint](mem://client-registration/terms-and-conditions-constraint) — T&C checkbox required before submit button
- [Header Navigation](mem://ui/header-navigation-updates) — Responsive header with Admin link removed
- [PhonePe QR](mem://pricing/phonepe-qr-payment-method) — Static PhonePe QR code for client payments
- [Member Slot Field](mem://client-registration/member-slot-field) — Mandatory morning/evening slot selection during registration
- [Live Photo Capture](mem://client-registration/live-photo-capture) — Live camera photo capture stored as base64
- [Scanner Search](mem://features/client-scanner-search) — Search clients by ID/Name, shows QR and payment breakdown
- [Brand Identity](mem://branding/identity-us-gymnasium) — Branded as US Gymnasium across all communications
- [Global Scrollbar](mem://ui/global-scrollbar-visibility) — Scrollbars hidden globally, vertical scrolling remains functional
- [Terms Signature](mem://client-registration/terms-signature-validation) — Mandatory typed name confirmation after T&C
- [PDF Export](mem://admin/pdf-export-enhancements) — Detailed table exports with payment and membership columns
- [Color Palette](mem://style/color-palette) — Vibrant Blue & Cyan visual theme using Tailwind CSS
- [Pricing Offers](mem://pricing/membership-offers-and-pt-rate-v3) — PT rate 15k/mo, strict duration-based discount matrix
- [T&C Scroll](mem://client-registration/terms-scroll-requirement-v2) — Hide T&C checkbox until scrolled to bottom of container
- [PWA Install UX](mem://features/pwa-installation-ux) — Custom /install page guiding native-like PWA installation
- [Lovable Limits](mem://constraints/lovable-platform-limitations) — Stick to React+Vite architecture, no Next.js/SSR
- [Installment Tracking](mem://admin/installment-payment-tracking-v2) — Track installment payments and send SNS reminders
- [PDF Customization](mem://admin/data-export-pdf-customization-v2) — Customizable PDF export modal with date range filters
- [Photo Optimization](mem://client-registration/photo-optimization-constraint) — Max 200x200px, 50% quality to fit API limits
