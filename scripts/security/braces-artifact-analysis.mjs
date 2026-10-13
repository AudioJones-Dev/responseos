export const targets=['eslint-config-next','@next/eslint-plugin-next','fast-glob','micromatch','braces'];
export function signals(text){
 return {names:targets.filter(name=>text.includes(name)),implementation:[['brace-expansion-walker',['expanded array length exceeds range limit','queue','append']],['brace-compile-walker',['escapeInvalid','node.nodes','output']]].filter(([,markers])=>markers.every(marker=>text.includes(marker))).map(([name])=>name)};
}
export function references(ts,filename,text){
 const source=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),result=[];
 function visit(node){
  let arg,kind;
  if(ts.isCallExpression(node)&&((ts.isIdentifier(node.expression)&&node.expression.text==='require')||node.expression.kind===ts.SyntaxKind.ImportKeyword)){
   arg=node.arguments[0];kind=node.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamic-import':'require';
  }else if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){arg=node.moduleSpecifier;kind='static-import-or-export';}
  if(kind&&arg){
   let containingFunction=null;const guards=[];
   for(let child=node,parent=node.parent;parent;child=parent,parent=parent.parent){
    if(!containingFunction&&ts.isFunctionLike(parent))containingFunction=parent.name?.getText(source)||parent.parent.name?.getText(source)||'<anonymous>';
    if(ts.isIfStatement(parent))guards.push({kind:'if',expression:parent.expression.getText(source).slice(0,600),branch:child===parent.thenStatement?'true':child===parent.elseStatement?'false':'condition'});
    else if(ts.isConditionalExpression(parent))guards.push({kind:'conditional',expression:parent.condition.getText(source).slice(0,600),branch:child===parent.whenTrue?'true':child===parent.whenFalse?'false':'condition'});
    else if(ts.isBinaryExpression(parent)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)&&child===parent.right)guards.push({kind:'short-circuit',expression:parent.left.getText(source).slice(0,600),operator:parent.operatorToken.getText(source),branch:'right'});
    else if(ts.isCaseClause(parent)||ts.isDefaultClause(parent)){
     const clauses=parent.parent.clauses,index=clauses.indexOf(parent),labels=[];
     for(let i=index;i>=0;i--){if(i<index&&clauses[i].statements.length)break;labels.unshift(ts.isCaseClause(clauses[i])?clauses[i].expression.getText(source):'default');}
     guards.push({kind:'switch-case',expression:ts.isCaseClause(parent)?parent.expression.getText(source):'default',discriminant:parent.parent.parent.expression.getText(source),labels});
    }else if(ts.isTryStatement(parent))guards.push({kind:'try-catch',handled:!!parent.catchClause,branch:child===parent.tryBlock?'try':child===parent.catchClause?'catch':'finally'});
   }
   const literal=ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg);
   result.push({kind,literal,guards,containingFunction,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,column:source.getLineAndCharacterOfPosition(node.getStart(source)).character+1,context:node.parent.getText(source).slice(0,1200),input:literal?arg.text:arg.getText(source).slice(0,180)});
  }
  ts.forEachChild(node,visit);
 }
 visit(source);return result;
}
