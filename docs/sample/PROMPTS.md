# Imagegen制作记录

工具：内置imagegen；所有调用 `transparent_background: true`，未使用CLI/API回退或密钥。项目最终采用三张PNG，路径和规格见 [ASSETS.md](ASSETS.md)。输入参考图均是本轮工具生成的原创图，没有把经典游戏截图送入生成工具作为编辑目标。

以下保留最终采用图片所依赖的提示词链。生成具有随机性，这些记录用于说明过程，不承诺再次生成得到相同像素。

## 1. 初始轻载图（作为后续编辑参考，未直接用于运行）

```text
Use case: stylized-concept. Production asset for a 2D classic arcade gold-mining browser game: a precise animation sprite sheet, exactly FOUR columns and TWO rows, EIGHT equally sized cells, no border and no text. Transparent background with real alpha. Wide sheet. Every cell shows the SAME original elderly stocky miner in a three-quarter side view FACING LEFT, operating the SAME small hand-cranked winch immediately to his left. Big expressive rounded orange nose, large white beard, bald head with a few grey hairs, rolled-up ochre brown shirt sleeves, blue dungarees, large brown work boots. Charming bold hand-drawn late-1990s/early-2000s Flash cartoon, clear dark brown outlines, solid saturated colors, minimal cel shading, no gradients, no 3D, no pixel art, no thin stick arms. Original design; don't copy any existing commercial game character. This sheet is ONE complete smooth LIGHT-LOAD CRANKING LOOP in row-major order: 0 degrees, 45,90,135,180,225,270,315. The visible near hand actually grips the round knob of the winch crank, completing that circle, with naturally bent elbows; the far arm braces the upper machine. The crank, hands and character are drawn together inside each cell. Keep camera, head shape, clothing, scale, boots positions and machine axle pixel-consistent across all eight cells. Both boots stay planted on the exact same horizontal baseline. Moderate forward-working stance, eyes looking at the mechanism, modest body movement, no independent decorative waving. Winch is a small wood-and-dark-iron drum on a squat triangular stand, its axle and rope exit identical in every cell. Full figure and machine unobstructed, comfortably within each cell with generous transparent gutters and no cell overlap. No ground, no cast shadow outside the boots, no background scenery, no items, no symbols. Each frame should be readable when reduced to approximately 240 pixels wide. Deliver all 8 full figures and machines, not just a pose study.
```

## 2. 采用的轻载图修正提示词

参考：初始轻载图。输出生成ID `exec-cd70399e-42b7-46d3-8b9f-7af75e6ef65a.png`，复制为 `public/assets/sample/miner-light.png`。

```text
Precise correction of this production sprite sheet. Keep the exact same character, machine, 4x2 grid, boots and static machine location in all cells. Transparent alpha. The arm MUST form a complete crank revolution. Eight frames in row-major order with near hand tightly holding the SAME crank knob around a fixed axle: frame 1 knob at 3 o'clock (right of axle), frame 2 at 1:30 (upper right), frame 3 at 12 (directly above), frame 4 at 10:30 (upper left), frame 5 at 9 (left), frame 6 at 7:30 (LOWER LEFT OF AXLE, hand partly in front of the left machine stand), frame 7 at 6 (DIRECTLY BELOW AXLE, hand low in front of machine stand), frame 8 at 4:30 (lower right). Keep crank radius identical throughout. Critical fix is bottom row second and third cell: their hands in the input are incorrectly right of axle and must be LOWER LEFT and STRAIGHT BELOW. Adjust elbows and shoulders naturally to reach these exact knob positions, without extra limbs. Crank is drawn continuously from axle to the hand position. Do not change character appearance or cartoon styling or machine scale. Keep full figure inside each cell. No text, no diagrams. This is a complete eight-step light-load winding loop; do not duplicate poses in the final three cells.
```

输出没有完全满足完整圆周的要求。因此运行时选择连续姿态作往复行程，没有把提示词写成已经达到的结果。

## 3. 采用的重载图

参考：第2步的轻载图。输出ID `exec-928b2ea0-37ff-408e-a053-767a8060c7b3.png`，复制为 `public/assets/sample/miner-heavy.png`。

```text
Edit this eight-cell LIGHT load crank sprite atlas into the matching HEAVY load atlas. Exact same image size, FOUR columns TWO rows, transparent alpha, same 8 cell locations and shared scale. Preserve ALL eight machines, their crank positions, grip points, boots baselines and boot horizontal locations in each corresponding cell. Preserve the full 8-step loop. Keep hand attached to each same crank knob and far hand bracing top of machine. Change the character only into a clearly STRAINING pose: shoulders farther back, bent knees bracing, body weight over the back/right boot, compressed mouth, slightly lowered brows, face focused on the mechanism, not furious. Same big-nose white-bearded friendly miner identity, ochre brown shirt, blue dungarees and brown boots. Leaning-back silhouette visibly different from light load, naturally articulated anatomy, not a pasted head on a fixed torso. Keep both feet planted and machine axle perfectly fixed. Do not enlarge character, no extra hands, no repeated final poses, no gradients, no background, no text or sweat effects. Smooth loop, tiny cel-shaded detail, bold cartoon contours readable small.
```

## 4. 采用的待机、放手和入账图

参考：第2步的轻载图。输出ID `exec-282eddbd-7717-426d-ad24-86e592dc0ecf.png`，复制为 `public/assets/sample/miner-poses.png`。

```text
Create the complementary eight transition poses for this exact game miner. Same 4 columns x 2 rows grid, aspect 2:1, true transparent background, same fixed miner scale, boots baseline and wood/iron winch locations. Use the SAME miner identity, same face, bald head, large white beard and big nose, ochre shirt, blue dungarees. Every cell has one FULL miner and winch, no cropping or overlap. Unlike the input, in ALL EIGHT cells the machine CRANK IS AT THE SAME right-side 3 O'CLOCK REST POSITION. Row-major action storyboard: cells 1 and 2 IDLE, relaxed ready stance, near hand rests on right-side crank knob, second pose only a subtle blink; cells 3,4,5 RELEASE: hand opens and lets go of knob, then pulls back slightly, then settles beside his hip while his eyes look down toward the rope exit; cells 6,7,8 DEPOSIT: satisfied smile, short head nod with hand off the crank, then looks down at the delivered prize, then returns near hand to the knob ready stance. No waving, no celebration arms in air, no coins, no UI, no words, no sparks, no background, no cast shadows outside the boots. The character and machine have to stay perfectly registered for animation with the input; feet and winch cannot move. Use strong clean Flash cartoon contours and flat cel colors matching the input. Keep scale absolutely identical and entire cell silhouettes separated by transparent gutters.
```
