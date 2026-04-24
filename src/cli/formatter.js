const chalk = require('chalk');

function printAnalysis(analysis, aiResponse) {
  console.log('\n' + chalk.gray('--------------------------------------------------'));
  
  // 1. Risk Level
  let levelStr = '';
  if (analysis.level === 'dangerous') {
    levelStr = chalk.bgRed.white.bold(` 🚨 DANGER (Score: ${analysis.score}/100) `);
  } else if (analysis.level === 'warning') {
    levelStr = chalk.bgYellow.black.bold(` ⚠️ WARNING (Score: ${analysis.score}/100) `);
  } else {
    levelStr = chalk.bgGreen.black.bold(` ✅ SAFE (Score: ${analysis.score}/100) `);
  }
  console.log(levelStr);
  console.log('');

  // 2. Confidence Level
  const confColor = aiResponse.confidence === 'HIGH' ? chalk.green : 
                    (aiResponse.confidence === 'MEDIUM' ? chalk.yellow : chalk.red);
  console.log(`${chalk.bold('🎯 Confidence Level:')} ${confColor(aiResponse.confidence)}`);

  // 3. Rule Matched & OS Hint
  console.log(`${chalk.bold('📌 Rule Matched:')} ${chalk.cyan(analysis.match)}`);
  if (analysis.osHint) {
    console.log(`${chalk.bold('💻 OS Context:')} ${chalk.magenta(analysis.osHint)}`);
  }

  // 4. Impact Summary
  console.log(`${chalk.bold('⚡ Impact Summary:')} ${chalk.red(aiResponse.impact)}`);
  
  // 5. Explanation
  console.log(`\n${chalk.bold('🧠 Explanation:')}`);
  console.log(chalk.gray(`   ${aiResponse.explanation}`));

  // 6. Consequences
  console.log(`\n${chalk.bold('💣 Consequences:')}`);
  console.log(chalk.gray(`   ${aiResponse.consequences}`));

  // 7. Safer Alternative
  console.log(`\n${chalk.bold('🛠️ Safer Alternative:')}`);
  console.log(chalk.green(`   ${aiResponse.saferAlternative}`));

  // 8. Safe When
  console.log(`\n${chalk.bold('✅ Safe When:')}`);
  console.log(chalk.blue(`   ${aiResponse.safeWhen}`));

  console.log(chalk.gray('--------------------------------------------------\n'));
}

module.exports = { printAnalysis };
