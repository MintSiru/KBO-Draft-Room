/* Voices: draft-day interview lines, the manager's comment and the scout director's advice.
   Pure text built from public information; nothing here affects the simulation. */
(function (root) {
  'use strict';
  const D = root.DraftData || (typeof require !== 'undefined' ? require('./prospects.js') : null);
  const S = root.DraftScouting || (typeof require !== 'undefined' ? require('./scouting.js') : null);
  const R = root.DraftRules || (typeof require !== 'undefined' ? require('./draft-ai.js') : null);
  const TEAMS = root.DraftClubs || (typeof require !== 'undefined' ? require('./clubs.js') : null);
  const { ROLES, rng, pick } = D;
  const K = D.ko;

  /** Adds interview/coach/scoutAdvice to the engine API `C` (avoids a require cycle). */
  function install(C) {
    const { teamFor, fit, myPicks, poolFor, available } = C;

    function interview(p, s, g, context = 'live') {
      const t = teamFor(g, s.teamId || g.teamId),
        r = rng(g.seed + '-voice-' + p.id + '-' + context),
        fav = g.difficulty === 'easy' && TEAMS[p.favoriteTeam].id === t.id;
      // Overall pick number; compared with the public rank to spot early or late calls.
      const actual = s.overall ?? (s.round - 1) * 10 + TEAMS.findIndex((x) => x.id === t.id) + 1;
      let openings;
      if (s.round === 0)
        openings = [
          `${p.region}에서 야구를 배운 선수로서 이 선택이 더 뜻깊습니다.`,
          `${p.school}에서 함께 땀 흘린 친구들이 먼저 떠오릅니다.`,
          `연고 지역을 대표한다는 책임감을 느낍니다.`,
        ];
      else if (p.pathway === '독립구단')
        openings = [
          `${K.p(p.history.at(-2).name, '을/를')} 거쳐 ${p.school}에서 다시 기회를 준비했습니다.`,
          '다시 불릴 수 있다고 믿고 버텼습니다. 기다려 준 가족들에게 고맙습니다.',
          '훈련을 마치고 혼자 돌아가던 날들이 생각납니다. 이제 새로운 출발입니다.',
        ];
      else if (p.pathway === '대학 얼리')
        openings = [
          `${p.school} 2학년으로 조기 도전에 나섰습니다. 배움의 자세로 시작하겠습니다.`,
          '졸업 전에 선택한 도전인 만큼 책임감을 가지고 준비하겠습니다.',
          '대학에서 배운 것을 바탕으로 프로의 긴 시즌에 적응하겠습니다.',
        ];
      else if (p.pathway === '대졸')
        openings = [
          `${K.p(p.highSchoolName, '을/를')} 거쳐 ${p.school}에서 준비한 시간이 떠오릅니다.`,
          `대학 무대에서 제 부족한 점을 배우고 보완했습니다.`,
          `고교 졸업 후 ${K.p(p.school, '을/를')} 선택한 것은 제 야구를 다지는 기회였습니다.`,
        ];
      else if (p.pathway === '해외파' || p.proExperience)
        openings = [
          '멀리서 쌓은 경험을 이제 이 무대에서 보여드리고 싶습니다.',
          `${p.school}에서 익힌 것을 한국 야구에 맞게 다듬겠습니다.`,
          '새로운 환경에 적응하는 데 주저하지 않겠습니다.',
        ];
      else if (p.rank < actual - 12)
        openings = [
          '이름이 불릴 때까지 긴장을 많이 했습니다. 이제 출발선은 같다고 생각합니다.',
          '기다린 시간이 길었지만 유니폼을 입는 순간만 생각하고 있었습니다.',
          '예상보다 늦게 불렸지만, 앞으로 보여드릴 것이 더 중요합니다.',
        ];
      else if (p.rank > actual + 12)
        openings = [
          '생각보다 일찍 불러 주셔서 놀랐습니다. 믿어 주신 만큼 더 준비하겠습니다.',
          '제 가능성을 높게 봐주신 것 같아 책임감이 큽니다.',
          '기대 이상의 순서로 불렸습니다. 제 장점을 확실히 살리겠습니다.',
        ];
      else
        openings = [
          `${t.short}의 선택을 받아 정말 기쁩니다.`,
          `${p.school}에서 함께 준비한 동료들과 이 기쁨을 나누고 싶습니다.`,
          '야구를 시작했을 때부터 기다려 온 순간입니다.',
          '끝까지 응원해 주신 가족과 지도자분들께 감사드립니다.',
        ];
      const ends =
        p.ready >= 45
          ? [
              '1군 경쟁부터 부딪쳐 보겠습니다. 맡겨 주시는 역할을 해내겠습니다.',
              '바로 통할 것이라고 단정하지는 않겠습니다. 캠프에서 하나씩 증명하겠습니다.',
              '첫 시즌부터 팀에 보탬이 되도록 준비하겠습니다.',
            ]
          : [
              '첫해를 서두르지 않겠습니다. 퓨처스에서 기본기를 다지겠습니다.',
              `${p.focus}에 먼저 집중하겠습니다. 매달 달라지는 모습을 보여드리겠습니다.`,
              '조급해하지 않고 몸과 기술을 프로 수준으로 끌어올리겠습니다.',
              '경기에 나서지 못하는 날에도 배울 것을 찾겠습니다.',
            ];
      const personality = {
        '차분한 노력파': '말보다 훈련으로 보여드리고 싶습니다.',
        '승부욕 강한 도전자': '같은 포지션 선배들에게도 당당하게 도전하겠습니다.',
        '밝은 분위기 메이커': '먼저 인사하고 많이 묻는 신인이 되겠습니다.',
        '분석을 즐기는 연구형': '제 경기 영상을 보면서 개선점을 찾고 있습니다.',
        '책임감 강한 리더': '함께 성장하는 동료가 되겠습니다.',
        '말보다 행동하는 실천형': '매일 정해 둔 훈련부터 지키겠습니다.',
        '꾸준함을 믿는 성실형': '하루의 작은 차이가 쌓인다고 믿습니다.',
        '큰 무대를 즐기는 대담형': '관중 앞에서 제 야구를 보여드릴 날이 기다려집니다.',
      };
      return [
        pick(openings, r),
        fav ? `응원하던 ${t.short}의 유니폼이라 더 특별합니다.` : personality[p.personality],
        pick(ends, r),
      ].join(' ');
    }
    function coach(p, g) {
      const t = teamFor(g),
        r = rng(g.seed + '-coach-' + p.id);
      const start =
        fit(p, t) >= 60
          ? pick(
              [
                `${ROLES[p.role]} 자원을 넓히려는 방향에 맞는 선택입니다.`,
                `우리 팀이 준비해 온 ${ROLES[p.role]} 보강 계획에 들어맞습니다.`,
                `필요했던 ${ROLES[p.role]} 자리에서 경쟁을 만들어 줄 선수입니다.`,
              ],
              r,
            )
          : pick(
              [
                '당장의 빈자리보다 이 선수만의 장점을 먼저 봤습니다.',
                '포지션이 겹치더라도 경쟁력 있는 재능은 확보할 가치가 있습니다.',
                '지금 전력에 없는 유형을 더해 보고 싶었습니다.',
              ],
              r,
            );
      const end =
        p.ready >= 45
          ? pick(
              [
                '캠프에서 경쟁할 기회를 주겠습니다. 첫해의 자리는 스스로 만들어야 합니다.',
                '당장 기여할 가능성을 봤지만, 프로 적응 과정을 면밀하게 지켜보겠습니다.',
                '보직을 미리 약속하지는 않겠습니다. 준비한 만큼 기회를 주겠습니다.',
              ],
              r,
            )
          : pick(
              [
                `${K.p(p.focus, '을/를')} 중심으로 육성 계획을 세우겠습니다. 첫해 1군 성적을 서두르지 않겠습니다.`,
                '퓨처스 코치진과 차근차근 준비시키겠습니다. 빠른 데뷔보다 좋은 습관이 먼저입니다.',
                '프로의 훈련량과 긴 시즌에 적응하는 것이 우선입니다. 기다려 줄 가치가 있다고 봅니다.',
                '첫해에는 결과보다 몸과 기술이 어떻게 달라지는지 보겠습니다.',
              ],
              r,
            );
      return start + ' ' + p.strength + ' ' + end;
    }
    function scoutAdvice(p, g) {
      const t = teamFor(g),
        mine = myPicks(g),
        byId = poolFor(g).byId,
        owned = mine.filter((s) => byId[s.playerId].role === p.role).length;
      const candidates = available(g),
        similar = candidates.filter((q) => q.role === p.role && q.rank <= p.rank + 15).length;
      const missing = t.needs.filter((role) => !mine.some((s) => byId[s.playerId].role === role));
      const lines = [];
      lines.push(
        p.ready >= 45
          ? '캠프에서 1군 경쟁에 도전할 만한 준비도입니다. 자리가 보장될 수준은 아닙니다.'
          : p.ready >= 35
            ? '기본기는 있지만 프로 공에 적응할 시간이 필요합니다. 짧은 콜업보다 꾸준한 육성도 괜찮은 첫해입니다.'
            : '첫해는 퓨처스 중심으로 보는 편이 안전합니다. 지금 성적보다 육성 과제를 감당할 수 있는지 판단해야 합니다.',
      );
      if (owned > 0)
        lines.push(
          `이미 ${ROLES[p.role]} ${owned}명을 지명했습니다. ${missing.length ? '아직 채우지 못한 ' + ROLES[missing[0]] + ' 자리도 함께 살펴볼 필요가 있습니다.' : '중복 지명을 해도 보강 점수가 더 올라가지는 않습니다.'}`,
        );
      else
        lines.push(
          fit(p, t) >= 60
            ? `${K.p(ROLES[p.role], '은/는')} 우리 팀의 ${t.needs.indexOf(p.role) + 1}순위 보강 과제입니다. 이 선수의 장점을 쓸 자리는 있습니다.`
            : '우선 보강 포지션은 아닙니다. 다른 자리를 포기하고도 이 재능을 택할지 판단해야 합니다.',
        );
      lines.push(
        `현재 지명 가능한 ${ROLES[p.role]} 중 이 선수 순위 +15위 이내 후보는 ${similar}명입니다. ${similar <= 2 ? '비슷한 유형이 곧 사라질 수 있습니다.' : '비슷한 후보의 강점과 준비도를 비교할 필요가 있습니다.'}`,
      );
      if (p.awards.length) lines.push('대표팀·대회 경력이 있어 큰 경기 경험은 충분합니다.');
      else if (p.record.kind === 'pitcher' && p.record.outs < 90)
        lines.push('시즌 투구 표본이 작은 편입니다. 좋은 평균자책점만으로 안정성을 확신하기는 어렵습니다.');
      else lines.push(`${K.p(p.focus, '이/가')} 육성의 주요 과제입니다.`);
      if (p.schoolTier)
        lines.push(
          p.schoolTier === '명문'
            ? '명문 야구부 출신이라 기본기 훈련은 충분히 받았습니다.'
            : p.schoolTier === '약소'
              ? '약소 야구부 출신입니다. 팀 성적보다 개인 기록을 보고 판단해야 합니다.'
              : `현재 소속 야구부 평판은 ${p.schoolTier}입니다.`,
        );
      lines.unshift(...S.explanation(R.project(p), t));
      if (g.difficulty === 'hard')
        return {
          title: p.name + '에 대한 스카우트 팀장의 조언',
          lines: [...S.explanation(R.project(p), t), p.weakness],
        };
      if (g.difficulty === 'easy') {
        const alternatives = candidates
          .filter((q) => q.id !== p.id)
          .sort((a, b) => b.publicScore + fit(b, t) * 0.12 - (a.publicScore + fit(a, t) * 0.12))
          .slice(0, 2);
        lines.push(
          '비교 후보는 ' +
            alternatives.map((q) => q.name + ' · ' + ROLES[q.role] + ' · 공개 ' + q.rank + '위').join(', ') +
            '입니다.',
        );
      }
      return { title: p.name + '에 대한 스카우트 팀장의 조언', lines };
    }

    Object.assign(C, { interview, coach, scoutAdvice });
  }

  const api = { install };
  root.DraftVoices = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
