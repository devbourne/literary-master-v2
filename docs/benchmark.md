# Ollama 모델 비교 벤치마크 — NVIDIA DGX Spark (GB10)

**측정일:** 2026-04-12
**하드웨어:** NVIDIA DGX Spark, GB10 Grace Blackwell Superchip, 128GB LPDDR5X 통합 메모리, ~273 GB/s 대역폭
**런타임:** Ollama 0.17.4 → 최신 버전 업그레이드 후 측정

---

## 1. 테스트 대상

| 모델 | 아키텍처 | 크기 | 양자화 |
|---|---|---|---|
| `bjoernb/gemma4-26b-fast` | MoE (A4B) | 17 GB | Q4 계열 |
| `qwen3:30b` | MoE | 18 GB | Q4 계열 |
| `gpt-oss:120b` | MoE | 65 GB | MXFP4 |

---

## 2. 테스트 1 — 단순 프롬프트

**프롬프트:** `Write a 500 word story about a robot learning to paint.`

| 모델 | eval rate | prompt eval | 총 시간 | 로드 시간 |
|---|---|---|---|---|
| qwen3:30b | **80.33 tok/s** | 366 tok/s | 30.4 s | 10.4 s |
| bjoernb/gemma4-26b-fast | 63.29 tok/s | **630 tok/s** | 79.2 s | 54.8 s |
| gpt-oss:120b | 37.94 tok/s | 12 tok/s | 56.4 s | 23.9 s |

**관찰:**
- **qwen3:30b** — 생성 속도 1위 (MoE 활성 파라미터가 작음)
- **gemma4-26b-fast** — prompt eval이 압도적(630 tok/s), 긴 컨텍스트·RAG에 유리
- **gpt-oss:120b** — 65GB 덩치에도 38 tok/s 유지, 메모리 대역폭이 병목

---

## 3. 테스트 2 — 정교한 창작 프롬프트

**프롬프트 요지:** 문학적 SF, 멜랑콜리 톤, 2147년 등대, 72세 Ines, 40년 전 침몰선의 모스 신호, 인미디어스 감각 오프닝, 단일 플래시백(2-3문장), 모호한 결말, 금지어(hope/beacon/echo/ghost), 해양생물학 은유 ≥2개, -ly 부사 회피, **정확히 500단어 ±10**.

### 3.1 속도

| 모델 | eval rate | 단어 수 | 생성 토큰 | 비고 |
|---|---|---|---|---|
| qwen3:30b | **78.43 tok/s** | 415 | 1,364 | thinking 없음 |
| bjoernb/gemma4-26b-fast | 55.99 tok/s | 491 | 20,751 | thinking 토큰 포함 |
| gpt-oss:120b | 41.43 tok/s | 508 | 9,451 | thinking 토큰 포함 |

### 3.2 제약 준수 평가

| 항목 | gemma4-26b | qwen3:30b | gpt-oss:120b |
|---|---|---|---|
| 500단어 (±10) | ✅ 491 | ❌ 415 (−75) | ✅ 508 |
| 금지어 회피 | ✅ | ❌ "ghost" 2회 | ❌ "hoping" 사용 |
| 감각 오프닝 | ✅ 배터리산 미각 | ✅ 렌즈 촉각 | ✅ 바닥 진동 |
| 단일 플래시백 (2-3문장) | ✅ 3문장 | ❌ 분산 | ✅ 2문장 |
| Ines 72세 명시 | ❌ | ❌ | ✅ |
| 해양생물학 은유 ≥2 | ✅ (marine snow, bioluminescent trench) | ✅ (mollusk, plankton, squid) | ✅ (whale ribcage, lanternfish, jellyfish, shark) |
| 모호한 결말 | ✅ | ✅ | ✅ |
| -ly 부사 회피 | ✅ | ❌ "truly", "finally" | ✅ |
| **준수 점수** | **7 / 9** | **4 / 9** | **7 / 9** |

### 3.3 산문 품질 (주관)

- **gemma4-26b-fast** — 과학적으로 정확하면서 시적인 은유. 억제된 톤이 문학적 SF에 가장 근접. thinking 토큰 20k를 쓴 흔적이 제약 준수에 드러남.
- **gpt-oss:120b** — 은유가 가장 풍부하고 감각적("shark's tooth slicing a school of sardines"). 72세 나이 명시 유일. 그러나 금지어 drift 발생.
- **qwen3:30b** — 남편 서브플롯 추가로 감정적 깊이가 있으나 단어 수 미달, 금지어 위반, 플래시백 분산으로 지시 충실도 최하.

---

## 4. 종합 결론

| 용도 | 권장 모델 |
|---|---|
| **순수 토큰 속도** | qwen3:30b (80 tok/s) |
| **긴 컨텍스트 / RAG (prompt eval)** | gemma4-26b-fast (630 tok/s) |
| **복잡한 제약이 있는 창작·추론** | gemma4-26b-fast (제약 준수 + thinking) |
| **풍부한 묘사·광범위한 지식** | gpt-oss:120b |
| **최고 품질 절대 우선, 속도 무관** | gpt-oss:120b |

**DGX Spark (273 GB/s 대역폭) 환경에서는 MoE 아키텍처가 dense 대비 압도적으로 유리**합니다. 31B dense 모델은 약 7 tok/s로 사실상 사용 불가이며, A4B MoE 구조인 gemma4-26b와 qwen3:30b가 가장 효율적인 스윗스팟입니다.

---

## 5. 테스트 3 — 2월 한국어 벤치마크 재현 (gemma4 신규 측정)

2026-02-28 보고서(`structural-labeling/model-benchmark-report.md`)의 동일 프롬프트를 gemma4-26b-fast에 적용해 직접 비교했습니다.

### 5.1 한국어 단답형

**프롬프트:** *"한국의 수도는 어디이며, 그 역사적 배경을 3문장으로 설명해주세요."*

| 모델 | 프롬프트 처리 | 생성 속도 | 로드 | 총 시간 | 한국어 품질 |
|---|---|---|---|---|---|
| **bjoernb/gemma4-26b-fast** ⭐ | **1,345.79 tok/s** | 64.13 tok/s | 7.8 s | 17.8 s | ✅ 자연스러움, 정확 |
| gpt-oss:120b (2월) | 305.89 tok/s | 42.73 tok/s | 32.4 s | 36.8 s | ✅ 자연스러움 |
| deepseek-r1:70b (2월) | 31.08 tok/s | 2.57 tok/s | 1m 9s | 3m 23.9s | ❌ 한자/일본어 혼입 |

**gemma4 응답:** 1394년 조선 건국, 한강 지리적 이점, 근현대 성장의 3문장으로 정확히 답변. 지시 준수 완벽.

### 5.2 수능 영어 독해 분석 (8개 항목)

**프롬프트:** Digital platforms / cloudwork 지문에 대해 주제·요지·제목·논리구조·핵심어휘 10개·빈칸추론·선지함정·한줄요약을 한국어로 작성.

#### 속도 비교

| 모델 | 프롬프트 처리 | 생성 속도 | 총 시간 | 생성 토큰 |
|---|---|---|---|---|
| **gemma4-26b-fast** (2026-04-12) | **2,873.07 tok/s** | 62.12 tok/s | **33.7 s** | 2,016 |
| qwen3:30b (2월) | 1,987.46 tok/s | **75.28 tok/s** | ~58 s | - |
| gpt-oss:120b (2월) | 305.89 tok/s | 42.73 tok/s | ~47 s | - |
| gemma3:27b (2월) | 806.16 tok/s | 11.48 tok/s | ~2m 6s | - |
| mistral-large:123b (2월) | 135.03 tok/s | 2.02 tok/s | ~14m 26s | - |
| deepseek-r1:70b (2월) | 31.08 tok/s | 2.57 tok/s | ~10분+ | - |

**gemma4는 2월 기준 모든 모델 대비 prompt eval 1위 (2,873 tok/s)**, 총 시간 최단(33.7s). 생성 속도는 qwen3:30b에 이어 2위.

#### 품질 평가 (5점 만점, 2월 보고서 루브릭 기준)

| 평가 항목 | gemma4-26b ⭐ | qwen3:30b | gpt-oss:120b | gemma3:27b |
|---|:-:|:-:|:-:|:-:|
| 한국어 지시 준수 | 5 | 5 | 5 | 5 |
| 8개 항목 완성도 | 5 | 5 | 5 | 5 |
| 핵심 어휘 (10개) | **5** (환각 없음) | 5 | 5 | 4 (frictionless 환각) |
| 논리 구조 분석 | 5 (5단계) | 5 (5단계) | 5 (7단계) | 4 (3단계) |
| 빈칸 추론 근거 | 5 (원문 인용) | 5 | 5 | 5 |
| 선지 함정 분석 | **5** (범위오류/인과역전/내용왜곡) | 5 | 5 | 5 |
| 제목 제시 | 5 (영문+한글 병기) | 5 | 5 | 5 |
| 한국어 자연스러움 | 5 | 5 | 5 | 5 |
| **평균** | **5.0** | **5.0** | **5.0** | **4.75** |

**gemma4 분석 품질 특이점:**
- **환각 없음**: gemma3:27b가 만든 'frictionless' 같은 원문 미등장 어휘 없음 (어휘 10개 전부 원문 근거)
- **학술적 깊이**: 'global reserve army'를 마르크스적 예비군 개념으로 정확히 설명
- **선지 함정 분류 세련화**: 범위 오류 / 인과 역전 / 내용 왜곡의 3가지 유형학적 분류 (gpt-oss:120b와 동급)
- **제목 이중 표기**: 영문 원안 + 한국어 번역 병기로 수능 출제 편의성 향상
- **빈칸 추론 원문 인용**: 정답 근거를 원문에서 직접 인용 (mistral-large가 실패한 부분)

### 5.3 종합 순위 업데이트 (2026-04-12)

| 순위 | 모델 | 품질 | 속도 | 효율 | 총평 |
|:-:|---|:-:|:-:|:-:|---|
| **1** | **bjoernb/gemma4-26b-fast** ⭐ | ★★★★★ | ★★★★★ | ★★★★★ | **신규 1위**. prompt eval 2,873 tok/s로 압도적, 품질 5.0, 17 GB |
| 2 | qwen3:30b | ★★★★★ | ★★★★★ | ★★★★★ | 생성 속도 1위(75→80 tok/s), 가성비 최강 |
| 3 | gpt-oss:120b | ★★★★★ | ★★★★☆ | ★★★☆☆ | 품질 최상, 65 GB로 동시 로드 제한 |
| — | ~~gemma3:27b~~ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | **제거됨** (gemma4로 교체) |
| — | mistral-large:123b | ★★★★☆ | ★☆☆☆☆ | ★☆☆☆☆ | DGX Spark에서 비실용적 |
| — | deepseek-r1:70b | ★★☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | 한국어 태스크 부적합 |

**핵심 변화:** 2월 1위였던 `qwen3:30b`와 동급 품질에 **prompt eval 속도가 44% 더 빠른** `gemma4-26b-fast`가 등장. 긴 컨텍스트·RAG·지시 따르기 태스크에서 우위.

---

## 6. 참고 자료

- 이전 벤치마크: `structural-labeling/model-benchmark-report.md` (2026-02-28, 5개 모델)
- 관련 평가: `structural-labeling/eval/EVALUATION_REPORT.md` (2026-03-02, QLoRA vs Prompt Tuning)
- [NVIDIA DGX Spark performance · Ollama Blog](https://ollama.com/blog/nvidia-spark-performance)
- [Gemma 4 26B-A4B NVFP4 on DGX Spark: 52 tok/s](https://www.ai-muninn.com/en/blog/dgx-spark-gemma4-26b-nvfp4-52-toks)
- [Gemma 4 Day-1 Inference on NVIDIA DGX Spark](https://forums.developer.nvidia.com/t/gemma-4-day-1-inference-on-nvidia-dgx-spark-preliminary-benchmarks/365503)
- [DGX Spark performance — NVIDIA Developer Forums](https://forums.developer.nvidia.com/t/dgx-spark-performance/356716)
