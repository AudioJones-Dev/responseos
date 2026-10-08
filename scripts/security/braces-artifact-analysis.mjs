export const targets=['eslint-config-next','@next/eslint-plugin-next','fast-glob','micromatch','braces'];
export function signals(text){
 return {names:targets.filter(name=>text.includes(name)),implementation:[['brace-expansion-walker',['expanded array length exceeds range limit','queue','append']],['brace-compile-walker',['escapeInvalid','node.nodes','output']]].filter(([,markers])=>markers.every(marker=>text.includes(marker))).map(([name])=>name)};
}
export function references(ts,filename,text){
 const source=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const result=[];
 function visit(node){
  let arg,kind;
  if(ts.isCallExpression(node)&&((ts.isIdentifier(node.expression)&&node.expression.text==='require')||node.expression.kind===ts.SyntaxKind.ImportKeyword)){
   arg=node.arguments[0];kind=node.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamic-import':'require';
  }else if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){arg=node.moduleSpecifier;kind='static-import-or-export';}
  if(kind&&arg){
   let containingFunction=null;const guards=[];
   for(let parent=node.parent;parent;parent=parent.parent){
    if(!containingFunction&&ts.isFunctionLike(parent))containingFunction=parent.name?.getText(source)||parent.parent.name?.getText(source)||'<anonymous>';
    if(ts.isIfStatement(parent))guards.push({kind:'if',expression:parent.expression.getText(source).slice(0,600)});
    else if(ts.isCaseClause(parent))guards.push({kind:'switch-case',expression:parent.expression.getText(source).slice(0,600)});
    else if(ts.isTryStatement(parent))guards.push({kind:'try-catch',handled:!!parent.catchClause});
   }
   const literal=ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg);
   result.push({kind,literal,guards,containingFunction,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,context:node.parent.getText(source).slice(0,1200),input:literal?arg.text:arg.getText(source).slice(0,180)});
  }
  ts.forEachChild(node,visit);
 }
 visit(source);return result;
}
