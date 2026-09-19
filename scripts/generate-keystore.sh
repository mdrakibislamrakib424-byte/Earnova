#!/bin/bash
echo "🔑 EARNOVA Keystore Generator"
echo "────────────────────────────"
echo "Password টা মনে রাখুন — এটা হারালে APK আর update দিতে পারবেন না!"
echo ""
keytool -genkey -v \
  -keystore earnova.keystore \
  -alias earnova \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=EARNOVA, OU=App, O=EARNOVA, L=Dhaka, S=Dhaka, C=BD"
echo ""
echo "📦 Base64 করছি GitHub Secrets-এর জন্য..."
base64 -w 0 earnova.keystore > keystore_base64.txt
echo "✅ keystore_base64.txt তৈরি হয়েছে"
echo ""
echo "GitHub → Settings → Secrets → Actions:"
echo "  KEYSTORE_BASE64 = keystore_base64.txt এর content"
echo "  KEYSTORE_PASS   = আপনার keystore password"
echo "  KEY_ALIAS       = earnova"
echo "  KEY_PASS        = আপনার key password"
