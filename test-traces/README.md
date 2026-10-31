# GhostTrace Test Traces Collection

এই ফোল্ডারে GhostTrace ড্যাশবোর্ড ও ফরেনসিক ইঞ্জিন টেস্ট করার জন্য ৬টি বাস্তবসম্মত Agent Trace JSON ফাইল রাখা হয়েছে।

## 📁 ফাইল তালিকা ও বিবরণ:

| ফাইল নাম | এজেন্ট নাম | ফেইলিওর মোড | ঘটনার সারসংক্ষেপ |
| :--- | :--- | :--- | :--- |
| **`test_trace_01_tool_crash_stripe_504.json`** | `BillingSettlementAgent` | `unhandled_tool_error` | Stripe গেটওয়ে থেকে 504 Gateway Timeout আসার পর এরর হ্যান্ডলিং না থাকায় প্রসেস ক্র্যাশ। |
| **`test_trace_02_infinite_loop_rag_query.json`** | `CustomerSupportRAGAgent` | `infinite_loop` | ভেক্টর ডেটাবেসে মিল না পেয়ে ক্রমাগত কুয়েরি রি-রাইট করে লুপে আটকে যাওয়া। |
| **`test_trace_03_parameter_hallucination_sql.json`** | `DataAnalyticsCopilot` | `parameter_hallucination` | ডেটাবেস স্কিমাতে না থাকা কাল্পনিক কলাম (`internal_user_credit_score`) জেনারেট করে কুয়েরি ফেইল। |
| **`test_trace_04_browserbase_dom_detachment.json`** | `CheckoutAutomationAgent` | `unhandled_tool_error` | Browserbase ব্রাউজার সেশনে পেমেন্ট আইফ্রেম রি-রেন্ডার হয়ে DOM ফ্রেম ডিটাচড এরর। |
| **`test_trace_05_context_overflow_summarizer.json`** | `LegalContractSummarizer` | `context_overflow` | ১৩৪,২০০ টোকেনের বড় আইনি নথি একবারে পাঠাতে গিয়ে মডেলের 128k কনটেক্সট উইন্ডো অতিক্রম। |
| **`test_trace_06_latency_stall_coordinator.json`** | `WorkflowCoordinatorAgent` | `latency_stall` | অ্যাসিনক্রোনাস ওয়ার্কার রেসপন্স না করায় ১২ সেকেন্ড স্টল হয়ে এসএলএ বাজেট ব্রেক। |

---

## 🚀 কীভাবে টেস্ট করবেন:

### পদ্ধতি ১: GhostTrace লাইভ ড্যাশবোর্ড থেকে (UI Upload)
1. আপনার লাইভ সাইট (https://ghosttrace-s26u.onrender.com/) ওপেন করুন।
2. উপরের হেডারে **`[Upload Trace]`** (বা মোবাইল ভিউতে **`[Upload]`**) বাটনে ক্লিক করুন।
3. মডাল ওপেন হলে **`Choose File`** দিয়ে এই ফোল্ডারের যে কোনো একটি JSON ফাইল সিলেক্ট করুন অথবা টেক্সট বক্সে JSON কোড পেস্ট করুন।
4. **`Import & Analyze`** বাটনে ক্লিক করুন।
5. সাথে সাথে পুরো ড্যাশবোর্ড (Waterfall Timeline, Root Cause Hypothesis, Vitest Regression Blueprint, Partner Intelligence) নতুন ট্রেস অনুযায়ী রি-রেন্ডার হবে।

### পদ্ধতি ২: API এন্ডপয়েন্টে সরাসরি টেস্ট
```bash
curl -X POST https://ghosttrace-s26u.onrender.com/api/traces/analyze \
  -H "Content-Type: application/json" \
  -d @test_trace_01_tool_crash_stripe_504.json
```
