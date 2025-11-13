- `vercel inspect mindjar-dashboard-cvv80t3y2-mindjarapp-9839s-projects.vercel.app --logs`
- `vercel redeploy mindjar-dashboard-cvv80t3y2-mindjarapp-9839s-projects.vercel.app`

# Добавь переменные

vercel env add AUTH_SECRET production

# (Vercel попросит ввести значение)

vercel env add NEXT_PUBLIC_BASE_URL production

# Введи: https://your-project.vercel.app

# После добавления переменных нужно передеплоить

vercel --prod
