# 모델 비교 분석: 문학 텍스트 아이러니 해석 능력

**측정일:** 2026-04-18
**테스트 작품:** O. Henry, "An Unfinished Story" (반전 해석 정확도)
**하드웨어:** NVIDIA DGX Spark (GB10, 128GB)

---

## 1. 테스트 설계

### 핵심 검증 포인트
작품 마지막 문장: *"I'm only the fellow that set fire to an orphan asylum, and murdered a blind man for his pennies."*

정답:
- **비교 대상**: 화자(범죄자) vs 고용주(저임금 착취자)
- **누가 더 나쁜가**: **고용주가 더 나쁨** — "only"는 "나는 단지 방화범일 뿐" = 착취자보다는 낫다
- **핵심 메시지**: 시스템적 착취(합법적)가 개인적 범죄(명백한)보다 더 큰 악

### 3가지 구성 테스트

| 구성 | Survey | Chunk 분석 | Synthesis | Verify |
|---|---|---|---|---|
| **gemma4 only** | gemma4 | gemma4 | gemma4 | gemma4 |
| **Qwen3.6 only** | Qwen3.6 | Qwen3.6 | Qwen3.6 | Qwen3.6 |
| **Hybrid** | gemma4 | Qwen3.6 | Qwen3.6 | gemma4 |

---

## 2. Survey (반전 감지) 결과

### gemma4-26b-fast (Ollama)
```
Twist: "꿈속의 천사가 지목한 '악인'의 정체가 저임금으로 노동력을 착취한 고용주들임을 폭로"
Irony: "축소 표현의 반어적 사용. 화자는 자신을 극악무도한 범죄자로 낮추어 표현함으로써, 
        고용주들이 더 근원적이고 거대한 악"
Comparison: "고용주들이 더 나쁘다"
```
**✅ 정확. 3회 연속 일관된 결과.**

### Qwen3.6-35B-A3B-FP8 (vLLM)
```
Twist: "나레이터가 자칭 방화범/살인자 vs 고용주들(저임금 착취자)"
Comparison: "고용주들이 더 나쁘다"  ← Survey는 맞게 잡음
```
**⚠️ Survey는 정확하지만, Verify에서 자체 모순 발생 (WRONG 판정)**

### Hybrid (gemma4 Survey)
```
Twist: "서술자 본인은 사회적 악인이라 규정하지만, 고용주들의 '합법적 악행'보다 차라리 낫다"
```
**✅ 정확**

---

## 3. Verify (독립 검증) 결과

| 구성 | Survey 정확도 | Verify 판정 | 최종 |
|---|---|---|---|
| **gemma4 only** | ✅ | ✅ CORRECT | **✅** |
| **Qwen3.6 only** | ✅ | ❌ WRONG (자체 모순) | **❌** |
| **Hybrid** | ✅ | ✅ CORRECT | **✅** |

### Qwen3.6의 Verify 실패 원인
Qwen3.6은 Survey에서 "고용주가 더 나쁘다"고 정확히 잡았지만, Verify 단계에서 독립적으로 재해석할 때 방향을 뒤집었습니다. 이는 **동일 모델이 같은 텍스트를 두 번 읽을 때 일관성이 없는 문제**입니다.

---

## 4. 속도 비교

| 구성 | Survey tok/s | Verify tok/s |
|---|---|---|
| gemma4 only | 31.1 | 21.6 |
| Qwen3.6 only | 36.3 | 32.2 |
| Hybrid | 25.6 | 15.3 |

Qwen3.6이 속도는 빠르지만, 정확도가 불안정합니다.

---

## 5. 근본 원인 분석

### 왜 gemma4가 아이러니 해석에서 더 안정적인가

| 요인 | gemma4-26b-fast | Qwen3.6-35B-A3B |
|---|---|---|
| **활성 파라미터** | A4B (4B) | A3B (3B) |
| **훈련 데이터** | Google — 영어 문학/학술 풍부 | Alibaba — 중국어/코딩 중심 |
| **설계 목표** | 범용 멀티모달 | 에이전틱 코딩 특화 |
| **thinking 모드** | 없음 (직접 답변) | 있음 (비활성화 필요) |
| **아이러니 해석** | 일관 정확 | 확률적 변동 (50/50) |

### 핵심 통찰
1. **활성 파라미터 4B > 3B**: 미묘한 뉘앙스(반어, 축소 표현)에서 33% 더 많은 연산이 차이를 만듦
2. **훈련 데이터 차이**: gemma4는 영어 문학 해석 패턴을 더 많이 학습
3. **코딩 모델의 한계**: Qwen3.6은 논리적/구조적 분석에 강하지만, 반어법 같은 비논리적 표현을 literal하게 읽는 경향
4. **thinking 모드 비활성화의 부작용**: Qwen3.6은 thinking이 기본이라, 끄면 충분히 "생각하지 않고" 답하는 경향

---

## 6. 권장 구성

### 문학 분석 용도

| 구성 | 정확도 | 속도 | 메모리 | 추천 |
|---|---|---|---|---|
| **gemma4 only** | ★★★★★ | ★★★★☆ | 17GB | **최우선 추천** |
| **Hybrid** | ★★★★★ | ★★★☆☆ | 17+34GB | 속도 필요 시 |
| Qwen3.6 only | ★★★☆☆ | ★★★★★ | 34GB | 비추천 (불안정) |

### 용도별 최적 모델

| 용도 | 모델 | 이유 |
|---|---|---|
| **문학 분석 (소설/단편)** | gemma4-26b-fast | 아이러니/반전 해석 정확, 한국어 자연스러움 |
| **코딩/Tool Calling** | Qwen3.6-35B | 네이티브 지원, 코드 생성 우수 |
| **수능 비문학 분석** | gemma4-26b-fast | 논리 구조 + 어휘 분석 정확 |
| **빠른 프로토타이핑** | Qwen3.6-35B | 속도 우선 |

---

## 7. 5작품 배치 비교 (2026-04-18)

### 테스트 작품 및 반전 유형

| # | 작품 | 반전 유형 | 정답 |
|---|---|---|---|
| 1 | Tobin's Palm | 숨겨진 정보 공개 | Katie Mahorner가 남자 집 부엌에 있었음 |
| 2 | An Unfinished Story | 사회 비판 아이러니 | 고용주(착취자) > 방화범/살인범 |
| 3 | The Gift of the Magi | 이중 반전 (상호 희생) | 머리카락 → 시계줄, 시계 → 머리빗 |
| 4 | The Cop and the Anthem | 역설 (상황적 아이러니) | 체포되려 할 때 안 되고, 개과천선 결심 시 체포 |
| 5 | The Furnished Room | 충격 반전 (숨겨진 사실) | 같은 방에서 연인이 일주일 전 자살했음 |

### Survey + Verify 정확도

| 작품 | gemma4 | Qwen3.6 | Hybrid |
|---|---|---|---|
| Tobin's Palm | ✅ | ❌ | ✅ |
| An Unfinished Story | ✅ | ✅ | ✅ |
| The Gift of the Magi | ✅ | ❌ | ✅ |
| The Cop and the Anthem | ✅ | ✅ | ✅ |
| The Furnished Room | ✅ | ❌ | ✅ |
| **합계** | **5/5** | **2/5** | **5/5** |

### 결론

**gemma4-26b-fast가 문학 분석에서 압도적으로 우수합니다.**

- **Verify 정확도**: gemma4 5/5, Hybrid 5/5, Qwen3.6 **2/5**
- Qwen3.6은 5개 중 3개(Tobin, Gift, Furnished Room)에서 반전을 오독
- gemma4와 Hybrid는 5개 모두 정확

**Hybrid vs gemma4-only 비교:**
- 정확도: 동일 (5/5)
- Hybrid에서 Qwen3.6이 담당하는 Chunk/Synthesis 단계는 속도가 20-30% 빠르지만, Survey+Verify가 gemma4이므로 최종 정확도는 동일
- Hybrid의 추가 복잡성(두 모델 관리)이 속도 이점을 정당화하지 못함

**최종 권장: gemma4-only**
- 문학 분석에는 gemma4 단독 사용
- Qwen3.6은 Tool Calling/코딩 전용으로 분리
- 현재 분석 파이프라인에서 Tool Calling은 사용되지 않으므로 Qwen3.6의 장점이 없음

### 속도 비교

| 구성 | Survey 평균 | 총 토큰 | 비고 |
|---|---|---|---|
| gemma4 | 16.9s (28 tok/s) | 적음 (간결) | 안정적 |
| Qwen3.6 | 8.4s (34 tok/s) | 보통 | **빠르지만 부정확** |
| Hybrid | 15.0s (27 tok/s) | 많음 (상세) | gemma4와 동등 정확도 |

## 8. gpt-oss:120b 추가 테스트 (2026-04-18)

### 5작품 Survey + Verify 결과

| 작품 | gemma4 | Qwen3.6 | gpt-oss:120b |
|---|---|---|---|
| Tobin's Palm | ✅ | ❌ | ❌ |
| An Unfinished Story | ✅ | ✅ | ❌ |
| The Gift of the Magi | ✅ | ❌ | ❌ |
| The Cop and the Anthem | ✅ | ✅ | ❌ |
| The Furnished Room | ✅ | ❌ | ❌ |
| **합계** | **5/5** | **2/5** | **0/5** |

### gpt-oss 실패 원인

1. **thinking 모드 간섭**: gpt-oss는 thinking 토큰을 대량 소비하여 content 생성에 할당되는 토큰이 부족. `think: false`로도 완전히 비활성화 안 됨
2. **반전 감지 실패**: Tobin's Palm에서 Katie 발견을 놓치고, Cop & Anthem에서 핵심 역설을 오독
3. **속도**: 17-23 tok/s로 gemma4(25-34 tok/s)보다 느림
4. **메모리**: 65GB 사용 (gemma4 17GB의 4배)

### 3모델 종합 비교

| 항목 | gemma4-26b-fast | Qwen3.6-35B | gpt-oss:120b |
|---|---|---|---|
| **반전 감지 정확도** | **5/5 (100%)** | 2/5 (40%) | 0/5 (0%) |
| **속도** | 25-34 tok/s | 35-45 tok/s | 17-23 tok/s |
| **메모리** | 17 GB | 34 GB | 65 GB |
| **한국어 품질** | ✅ 자연스러움 | ⚠️ 한자 혼입 | ✅ 자연스러움 |
| **활성 파라미터** | A4B (4B) | A3B (3B) | MoE (~?) |
| **thinking 모드** | 안정적 비활성화 | 안정적 비활성화 | ❌ 불완전 비활성화 |
| **문학 분석 적합성** | ★★★★★ | ★★★☆☆ | ★☆☆☆☆ |

### 최종 결론

**gemma4-26b-fast가 문학 분석에서 압도적 1위.**
- 가장 작은 메모리(17GB), 가장 높은 정확도(5/5), 안정적 속도
- 파라미터 크기가 품질을 결정하지 않음 — 활성 파라미터, 훈련 데이터, 아키텍처가 더 중요
- gpt-oss:120b는 65GB를 사용하면서도 0/5로 최하위 — thinking 모드와 반전 감지 능력의 한계

## 9. Qwen3.5-122B-A10B-NVFP4 추가 테스트 (2026-04-18)

### 5작품 Survey + Verify 결과

| 작품 | gemma4-26b | Qwen3.6-35B | gpt-oss:120b | **Qwen3.5-122B** |
|---|---|---|---|---|
| Tobin's Palm | ✅ | ❌ | ❌ | **✅** |
| An Unfinished Story | ✅ | ✅ | ❌ | **✅** |
| The Gift of the Magi | ✅ | ❌ | ❌ | **✅** |
| The Cop and the Anthem | ✅ | ✅ | ❌ | **✅** |
| The Furnished Room | ✅ | ❌ | ❌ | **✅** |
| **합계** | **5/5** | **2/5** | **0/5** | **5/5** |

### 4모델 종합 비교

| 항목 | gemma4-26b-fast | Qwen3.5-122B NVFP4 | Qwen3.6-35B FP8 | gpt-oss:120b |
|---|---|---|---|---|
| **반전 정확도** | **5/5** | **5/5** | 2/5 | 0/5 |
| **속도** | 25-34 tok/s | **11 tok/s** | 35-45 tok/s | 17-23 tok/s |
| **메모리** | **17 GB** | 71 GB | 34 GB | 65 GB |
| **활성 파라미터** | A4B (4B) | **A10B (10B)** | A3B (3B) | MoE |
| **키워드 적중** | 보통 | **높음 (5/7 최고)** | 보통 | 낮음 |
| **로딩 시간** | ~8s | ~10분 | ~16분 | ~30s |
| **한국어** | ✅ | ✅ | ⚠️ 한자혼입 | ✅ |

### 핵심 발견

1. **Qwen3.5-122B도 gemma4와 동일한 5/5 정확도** — 활성 파라미터 10B의 힘
2. **키워드 적중률은 122B가 최고** — An Unfinished Story에서 5/7로 가장 많은 핵심어 포함
3. **속도 trade-off**: 11 tok/s로 gemma4(28 tok/s)의 절반 이하 — 분석 시간 2배+
4. **메모리 trade-off**: 71GB로 gemma4(17GB)의 4배 — 다른 모델 동시 실행 불가
5. **Qwen3.6-35B(A3B)와 극적 차이**: 같은 Qwen 계열인데 활성 파라미터 3B→10B 차이가 정확도 2/5→5/5

### 용도별 최종 권장

| 용도 | 모델 | 이유 |
|---|---|---|
| **일상 분석 (기본)** | **gemma4-26b-fast** | 정확도 동등, 속도 3배, 메모리 1/4 |
| **최고 품질 심층 분석** | **Qwen3.5-122B NVFP4** | 키워드 적중 최고, 정확도 동등, 단 느림 |
| **코딩/Tool Calling** | Qwen3.6-35B FP8 | 네이티브 지원 (문학 분석에는 부적합) |
| **비추천** | gpt-oss:120b | 65GB 쓰면서 0/5 — 가성비 최악 |

## 10. 다음 단계

1. Next.js 앱에서 모델 선택 기능 추가 (Ollama gemma4 / vLLM Qwen3.6)
2. 문학 분석 기본값을 gemma4로 설정
3. Tobin's Palm도 gemma4로 재테스트하여 일관성 확인
4. 다른 작품 (Gift of the Magi 등)으로 추가 검증

---

## 8. 참고

- gemma4 벤치마크: `ollama_dgx_spark_benchmark.md` (2026-04-12)
- Qwen3.6 벤치마크: `benchmark_2026-04-12/qwen36_vllm_benchmark.md`
- 이전 모델 비교: `structural-labeling/model-benchmark-report.md`
