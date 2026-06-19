const text = "Bu juda zo'r <b va shundan keyin hammasi o'chib ketadi";
console.log(text.replace(/<[^>]*>?/gm, ''));
