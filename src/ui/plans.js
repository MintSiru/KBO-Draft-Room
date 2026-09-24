/* Development plans: focus, position and two-way choices for our players before a season. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, player, playerLink } = UI;

  const focusLabel = (key) => (key === 'balanced' ? '균형' : C.grades.LABELS[key] || key);

  /** `plans`: playerId → { role?, focus?, twoWay? } being edited. */
  function planPanel(g, plans, heading) {
    const opts = C.planOptions(g);
    if (!opts.length) return '';
    const F = C.tuning.focus;
    const rows = opts
      .map((o) => {
        const p = player(g, o.playerId),
          st = g.career?.players[o.playerId],
          cur = plans[o.playerId] || {},
          role = cur.role ?? o.role,
          kind = UI.kindOf(role),
          focus = cur.focus ?? (kind === o.kind ? o.focus : 'balanced'),
          twoWay = cur.twoWay ?? o.twoWay;
        const focusKeys = ['balanced', ...C.Career.FOCUS_KEYS[kind]];
        const opt = (v, label, on) => `<option value="${v}" ${on ? 'selected' : ''}>${esc(label)}</option>`;
        const roleSelect = o.roleOptions.length
          ? `<select data-plan-role="${esc(o.playerId)}" aria-label="${esc(p.name)} 포지션">${opt(o.role, `${C.ROLES[o.role]} 유지`, role === o.role)}${o.roleOptions
              .map((r) => opt(r, UI.kindOf(r) !== o.kind ? `${C.ROLES[r]} 전향` : `${C.ROLES[r]}로 이동`, role === r))
              .join('')}</select>`
          : `<span class="muted">${o.inService ? '복무 중' : C.ROLES[o.role]}</span>`;
        const showOther = o.twoWayCapable || o.roleOptions.includes(o.other.role);
        return `<tr>
          <td>${playerLink(p.id, p.name)}${o.twoWay ? ` ${tag('이도류')}` : ''}<small>${C.ROLES[o.role]} · 공개 기량 ${st?.scoutReady ?? p.ready} · FV ${st?.scoutFV ?? p.scoutCeiling}${showOther ? ` · ${C.ROLES[o.other.role]}로는 ${o.other.ready} / FV ${o.other.fv}` : ''}</small></td>
          <td>${roleSelect}</td>
          <td><select data-plan-focus="${esc(o.playerId)}" aria-label="${esc(p.name)} 육성 방향">${focusKeys.map((k) => opt(k, focusLabel(k), focus === k)).join('')}</select></td>
          <td>${o.twoWayCapable ? `<select data-plan-twoway="${esc(o.playerId)}" aria-label="${esc(p.name)} 투타 겸업">${opt('true', '겸업', twoWay)}${opt('false', '한쪽 전념', !twoWay)}</select>` : ''}</td>
        </tr>`;
      })
      .join('');
    return `<h2 class="rule">${esc(heading)}</h2>
      <p class="note">육성 방향을 정하면 그 능력은 ${F.chosen}배 빨리, 나머지는 ${F.others}배로 자랍니다. 포지션을 옮기면 첫 시즌은 적응 기간이라 1군 경쟁과 성장이 조금 불리합니다. 내야→외야는 수비가 쉬워지고, 외야→내야는 어려워집니다. 투수↔타자 전향은 만 ${C.tuning.positions.sideSwitchMaxAge}세까지 가능합니다. 이도류는 두 쪽 모두 뛰지만 각각 조금 느리게 자랍니다.</p>
      <div class="table-scroll"><table class="t plan-table"><thead><tr><th>선수</th><th>포지션</th><th>육성 방향</th><th>투타 겸업</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  Object.assign(UI, { planPanel, focusLabel });
})(typeof window !== 'undefined' ? window : globalThis);
