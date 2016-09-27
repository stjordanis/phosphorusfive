
/*
 * CodeMirror module for editing Hyperlisp files.
 * Will take care of most cases of indentation correctly, automatically,
 * and also show keywords, expressions, type declarations, and Active 
 * Event invocations with a special coloring that makes it easier to read code.
 *
 * File is a CodeMirror plugin
 */

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") {
    mod(require("../../lib/codemirror"));
  } else if (typeof define == "function" && define.amd) {
    define(["../../lib/codemirror"], mod);
  } else {
    mod(CodeMirror);
  }
})(function(CodeMirror) {
"use strict";


/*
 * CodeMirror plugin declaration for Hyperlisp code type
 */
CodeMirror.defineMode("hyperlisp", function() {
  return {

    /*
     * Defines the different CSS class names for the different types of entities in Hyperlisp.
     * Notice, some of the Hyperlisp types doesn't really exist in other programming languages,
     * vice versa, hence it's not always "intuitive" which CSS class a Hyperlisp entity is using.
     *
     * Hyperlisp uses only these classes from a traditional CodeMirror theme;
     *
     *  - comment      ==>  Used for comments and multiline comments
     *  - string       ==> Used for strings and multiline strings
     *  - keyword      ==> Used for p5.lambda keywords, such as [while] and [if]
     *  - atom         ==> Used for operators, such as "!=" and ">="
     *  - variable     ==> Used for "variables", meaning a node having a name starting with "_"
     *  - variable-2   ==> Used for Active Event invocations, meaning a node having a name containing "."
     *  - def          ==> Used for type declarations of a node's value
     *  - number       ==> Used for p5.lambda expressions
     *  - property     ==> Used for a node's value, unless it's an expression or a string literal value
     *  - error        ==> Used for syntactic Hyperlisp errors. Normally this means that the entire rest of the document goes into "error mode"
     *  - tag          ==> Used for displaying widget types, among other things, such as [literal], [container] and [void], in addition to all HTML element names
     *
     * In addition, if you wish, you can give all attributes, properties and widget creation invocations of widgets 
     * (HTML elements) additional coloring, by creating the CSS classes "widget-attribute", "widget-property" and "widget-type" 
     * in your CodeMirror theme
     *
     *
     * The following CodeMirror theme classes are NOT used by the Hyperlisp CodeMirror plugin
     *  - bracket
     *  - link
     */
    styles: {

      /*
       * Single line comment, starts with "//"
       */
      comment:'comment',

      /*
       * String literal, e.g. "foo"
       */
      string:'string',

      /*
       * Value of node, except when it is either an expression, string or multiline string,
       * at which case any of the previously mentioned (see above) types have presedence
       */
      value:'property',

      /*
       * Keyword, e.g. [while], [if] etc
       */
      keyword:'keyword',

      /*
       * Variable declaration, e.g. "_foo".
       * Defined as starting with an underscore ("_")
       */
      variable:'variable',

      /*
       * Active Event invocation, e.g "sys42.foo-bar".
       * Defined as having a period (".") in it somewhere, in addition
       * to being the name of a node
       */
      activeevent:'variable-2',

      /*
       * Hyperlisp value type declaration, found inbetween name of node and value, e.g.
       * "foo:int:54" - "int" is here type declaration
       */
      type:'def',

      /*
       * p5.lambda expression content, e.g. "/../[0,5]/_data?value"
       */
      expression:'number',

      /*
       * Widget property, for instance [events] and [widgets]
       */
      widget_property:'tag widget-property',

      /*
       * Widget attribute, for instance [href], [element], etc
       */
      widget_attribute:'tag widget-attribute',

      /*
       * Widget or HTML element name node, for instance [literal], [void], [div] etc
       */
      widget_type:'tag widget-type',

      /*
       * Displayed when there is a syntacic error in Hyperlisp, e.g. a space too much or little
       * in front of name, or a string literal is not closed, etc.
       */
      error:'error'
    },



    /*
     * Invoked by CodeMirror to see how we should indent current line of code.
     * "state.indent" is an internally kept variable, that tracks the current indentation,
     * according to the name of the node given.
     */
    indent: function (state, textAfter) {
      return state.indent;
    },



    /*
     * Initial state of parser, invoked by CodeMirror as it is starting to parse
     * the given Hyperlisp. Setting mode to "name" and indent to "0", to make sure
     * we start out with name being default state, and no indentation occurring
     */
    startState: function() {
      return {
        mode:'name',
        indent:0,
        previousIndent:0,
        noContent:true // Only true if this is first "content" of Hyperlisp, which makes sure first node starts with "no indentation"
      };
    },



    /*
     * Tokenizer main function, invoked by CodeMirror.
     * Given "state.mode" is which state the tokenizer is within, and defines
     * the rule-set to use when parsing from current position in document.
     */
    token: function(stream, state) {

      /*
       * Checking current state of tokenizer, and invoking the 
       * correct tokenizer logic accordingly.
       * Not all modes have specialized tokenizer, for instance, single line string mode,
       * don't need its own tokenizer mode, since it's a "special case" of "value mode"
       */
      switch (state.mode) {
        case 'name':

          /*
           * Hyperlisp "name" mode
           */
          return this.tokenizeNameMode (stream, state);
        case 'value':

          /*
           * Hyperlisp "value" mode
           */
          return this.tokenizeValueMode (stream, state);
        case 'mcomment':

          /*
           * Hyperlisp multiline comment mode
           */
          return this.tokenizeMultiCommentMode (stream, state);
        case 'mstring-name':

          /*
           * Hyperlisp multiline string mode
           */
          return this.tokenizeMultilineStringMode (stream, state, true);
        case 'mstring-value':

          /*
           * Hyperlisp multiline string mode
           */
          return this.tokenizeMultilineStringMode (stream, state, false);
        case 'error':

          /*
           * No need to continue parsing, rest of document is erronous, and there
           * are no ways we can recover anyway. Yielding "error" for the rest of the document,
           * and skipping the rest of tokenizing process
           */
          stream.skipToEnd();
          return this.styles.error;
      }
    },



    /*
     * The next functions are "tokenizer functions", referred to from above
     * "token" function, and takes a "token stream" and tokenizer's current "state"
     * as input, and modifies the stream by increasing its pointer forward into its
     * content, and changes the state according to what type of token it found.
     *
     * After the functions have done that, it returns a (possibly new) state back to caller,
     * that helps CodeMirror figure out which CSS class(es) to render current token with,
     * and keeping track of where it currently is in its parsing process
     */



    /*
     * Invoked when parser is parsing a "name" entity
     */
    tokenizeNameMode: function (stream, state) {

      /*
       * Figuring out indentation by seeking forward into stream, as long as we have space " ",
       * storing the number of spaces we find, since no node can have more than its previous nodes number
       * of spaces + 2 spaces of its own, maximum
       */
      var pos = 0;
      while (stream.peek() == ' ') {
        pos += 1;
        stream.next();
      }

      /*
       * Figuring out which type of token this is, by checking first character, without removing it from stream
       */
      var retVal = null;
      var cr = stream.peek();
      switch (cr) {
        case '"':

          /*
           * This is a single line string literal (hopefully, unless there's a bug in it),
           * checking for indentation bugs first
           */
          state.noContent = false;
          stream.next();
          if (this.checkIndentation (state, pos) === true) {
            return this.styles.error;
          }

          /*
           * Then parsing string literal
           */
          return this.parseSingleLineStringLiteral (stream, state);
        case '@':

          /*
           * This is (possibly) a multi line string literal (hopefully, unless there's a bug in it)
           * First checking for indentation bugs
           */
          if (this.checkIndentation (state, pos) === true) {
            return this.styles.error;
          }

          /*
           * Then fetching next character, to check for sure, whether or not this is a multi line string literal
           */
          state.noContent = false;
          stream.next();
          cr += stream.next();
          if (cr == '@"') {
            state.mode = 'mstring-name';
            state.oldIndent = state.indent;
            state.indent = 0;
            return this.tokenizeMultilineStringMode (stream, state, true);
          }

          /*
           * NOT a multi line string literal, just happens to be a name starting with "@",
           * "fallthrough" to logic after switch
           */
          break;
        case ':':

          /*
           * This is a node with an "empty" name, first checking indentation for bugs,
           * WITHOUT removing ":" from stream
           */
          if (this.checkIndentation (state, pos) === true) {
            return this.styles.error;
          }

          /*
           * Switching to "value" mode, and returning "type"
           */
          state.noContent = false;
          state.mode = 'value';

          /*
           * Returning "type", since next in stream is ":"
           */
          return this.styles.type;
        case '/':

          /*
           * Possibly a comment, either multi line comment, or single line comment, but first
           * checking next character before we determine if it is a comment or not
           */
          stream.next();
          if (stream.peek() == '/') {

            /*
             * Single line comment
             */
            return this.parseSingleLineComment(stream, state);
          } else if (stream.peek() == '*') {

            /*
             * Multi line comment
             */
            state.mode = 'mcomment';
            return this.tokenizeMultiCommentMode(stream, state);
          }

          /*
           * NOT any type of comment, just happens to be a name starting with "/",
           * "fallthrough" to logic after switch
           */
          break;
      }

      /*
       * Not a string literal, neither multi line, nor single line. Neither is it any type of comment,
       * and it is not a node without name. Figuring out name of node, by reading until we see either
       * "end of line" or ":".
       * But first checking for indentation bugs, but only if line does not exclusively contain spaces, at which
       * point "cr" should be null
       */
      stream.next();
      if (cr != null) {
        if (this.checkIndentation (state, pos) === true) {
          return this.styles.error;
        }
      }

      /*
       * Finding node's name, by looping until we see either "end of line" or ":"
       */
      var word = cr;
      while (true) {
        cr = stream.peek();
        if (cr == null) {

          /*
           * End of line, next node is name, hence no needs to update state
           */
          stream.next();
          break;
        } else if (cr == ':') {
          break;
        } else {
          stream.next();
        }
        word += cr;
      }

      /*
       * Word is now the name of our node, checking how our while loop ended, which
       * can be either "end of line", or "switch to value mode"
       */
      if (cr == ':') {

        /*
         * Stream did not end with "end of line", hence next token will have to be some sort of value.
         * Changing state of tokenizer to reflect that fact
         */
        state.mode = 'value';
        retVal = this.styles.type;
      } // else, also next node is possibly name or comment node ...! Hence, not changing state of tokenizer!!

      /*
       * Checking if node had a name, and if so, handle it in another function, to determine what
       * "type" of name it was, which can be "Active Event type of name", "keyword", "widget type", etc.
       * This process has consequences for indentation, and might increase indentation 
       */
      state.noContent = false;
      if (word != null && word.length > 0) {
        retVal = this.getNodeNameType (word, state);
      }
      return retVal;
    },



    /*
     * Invoked when parser is parsing a "value" entity
     */
    tokenizeValueMode: function (stream, state) {

      /*
       * Checking if this is an expression
       */
      if (this.is_ex === true) {

        /*
         * After expression is parsed, next token must be a name, hence updating state, before parsing until end of expression
         */
        state.mode = 'name';
        this.is_ex = false;
        return this.parseLambdaExpression (stream, state);
      }

      /*
       * Getting next token out of stream
       */
      var cr = stream.next();

      /*
       * Defaulting state to "value"
       */
      var retVal = this.styles.value;

      /*
       * Figuring out what type of value token this is
       */
      switch (cr) {
        case '"':

          /*
           * Single line string literal
           */
          state.mode = 'name';
          return this.parseSingleLineStringLiteral (stream, state);
        case '@':

          /*
           * Possibly a multi line string literal, but we don't quite know yet!
           */
          cr = stream.peek();
          if (cr == '"') {

            /*
             * Multi line string literal
             */
            stream.next();
            state.mode = 'mstring-value';
            state.oldIndent = state.indent;
            state.indent = 0;
            retVal = this.tokenizeMultilineStringMode (stream, state, false);
          } else {

            /*
             * Just so happens to be a node who's value starts with "@",
             * looping until "end of line", and returning value (default)
             */
            state.mode = 'name';
            while (stream.next() != null) {
              // do nothing
            }
          }
          break;
        case ':':

          /*
           * Possible "type carry over" from value tokenizer logic, we don't know quite yet
           */
          retVal = this.styles.type;
          if (stream.peek() == null) {
            state.mode = 'name';
          }
          break;
        default:

          /*
           * Not any type of string literal, possibly either a type declaration, or a value
           * Need further examining before we know for sure.
           * Looping until we see either a ":" or "end of line"
           */
          while (true) {

            /*
             * Fetching next character out of stream
             */
            cr = stream.next();
            if (cr == null) {

              /*
               * We're at "end of line", hence next mode is "name"
               */
              state.mode = 'name';
              break;
            } else if (cr == ':') {

              /*
               * Checking for type declaration, without value, which might occur in e.g. expressions
               */
              if (stream.peek() == null) {
                state.mode = 'name';
                break;
              }

              /*
               * End of "type declaration" for value of node, now checking if this particular
               * type is a p5.lambda expression or not. Expressions have special treatment
               */
              if (stream.string.substring(stream.start, stream.pos - 1) == 'x') {
                this.is_ex = true;
              } // else, some arbitrary type, such as "bool", "int", etc ...

              /*
               * Return value for style of currently tokenized content is anyways a "type" declaration,
               * regardless of whether or not it was an expression ...
               */
              retVal = this.styles.type;
              break;
            }
          }
          break;
      }
      return retVal;
    },



    /*
     * Invoked when parser is parsing multi line comment
     */
    tokenizeMultiCommentMode: function (stream, state) {

      /*
       * No needs to be "fancy" here, simply skip til "end of line", and then parse content, to see
       * if we passed "end of multi line comment" or not ...
       * This is done since a multiline comment (or a normal comment for that matter), in Hyperlisp,
       * is NOT, I repeat *NOT* allowed to have ANY content after it is closed, to avoid creating
       * the weirdest intentation nightmare you could imagine ...!!
       */
      stream.skipToEnd();
      var cur = stream.current();
      if (cur.indexOf('*/', cur.length - 2) != -1) {

        /*
         * End of comment, hence name must follow
         */
        state.mode = 'name';
      } else if (cur.indexOf('*/') != -1) {

        /*
         * Somehow coder managed to stuff something *AFTER* multi line comment, on same line,
         * which is illegal in Hyperlisp (see over)
         * Returning "error" which stops tokenizing the rest of the document, leaving everything from here,
         * until the end of the document in "error state"
         */
        state.mode = 'error';
        return this.styles.error;
      } // else, comment spans more lines. We still haven't seen the end of it yet. Hence, not changing state of tokenizer
      return this.styles.comment;
    },



    /*
     * Invoked when parser is parsing a multi line string name entity
     */
    tokenizeMultilineStringMode: function (stream, state, more) {

      /*
       * The "hard" way of parsing a multi line string, since it might be followed by a "value" entity,
       * on the same line as where it ends
       */
      var cr = stream.next();

      /*
       * Used to keep track of whether or not we've seen the end of multi line string literal
       */
      var seenTheEnd = false;

      /*
       * Looping until we see only ONE '"'.
       * This is because two '"' after each other ('""' that is), means the '"' is escaped,
       * and the string literal is still open
       */
      while (cr != null) {

        /*
         * Checking for easy "end of multi line string" condition, meaning one '"' character, 
         * WITHOUT another '"' following it
         */
        if (cr == '"' && stream.peek() != '"') {

          /*
           * End of multi line string literal, breaking while
           */
          seenTheEnd = true;
          break;
        } else if (cr == '"' /* Implicitly another '"' is following here in stream */) {

          /*
           * "Hard case", needs to loop until we do not see another '"', and then count
           * the number of '"' we saw afterwards
           */
          var val = cr;
          while (cr == '"') {
            cr = stream.peek();
            if (cr == '"') {
              val += cr;
              stream.next(); // Avoids removing character out of stream, unless it's another '"'
            }
          }

          /*
           * If our number of '"' are even, we are at end of multi line string literal
           */
          if (val.length % 2 == 1) {

            /*
             * End of multi line string literal.
             * Breaking outer while loop
             */
            seenTheEnd = true;
            break;
          }
        } else {
          cr = stream.next();
        }
      }

      /*
       * Checking if we've seen the end of multi line string literal
       */
      if (seenTheEnd) {

        /*
         * Resetting indent again
         */
        state.indent = state.oldIndent;

        /*
         * Checking if there's a value or a type declaration behind multi line string name
         */
        cr = stream.peek();
        if (!more && cr != null) {

          /*
           * "Garbage data" found after closing of multi line string literal as value
           */
          state.mode = 'error';
          return this.styles.error;
        }
        if (cr == null) {

          /*
           * No value for this guy!
           */
          state.mode = 'name';
        } else if (cr == ':') {

          /*
           * Value follows
           */
          state.mode = 'value';
        } else {

          /*
           * "Garbage data" found after closing of multi line string literal
           */
          state.mode = 'error';
          return this.styles.error;
        }
      }
      return this.styles.string;
    },




    /*
     * The next functions are internally used helper functions, used during
     * tokenizing process somehow
     */



    /*
     * Invoked when parser is parsing a single line string entity, either as "name" or as "value"
     */
    parseSingleLineStringLiteral: function (stream, state) {
      var cr = stream.next();
      var prev = '';
      while (true) {
        if (cr == '"' && prev != '\\') {
          stream.eatSpace();
          if (stream.peek() != null && stream.peek() != ':') {
            state.mode = 'error';
            stream.skipToEnd();
            return this.styles.error;
          }
          break;
        }
        if (cr == null) {
          state.mode = 'error';
          return this.styles.error;
        }
        prev = cr;
        cr = stream.next();
      }
      return this.styles.string;
    },



    /*
     * Invoked when parser is parsing an expression as a "value" entity
     */
    parseLambdaExpression: function (stream, state) {

      // TODO: implement support for multiline expressions here ...
      stream.skipToEnd();
      return this.styles.expression;
    },



    /*
     * Invoked when parser is parsing a single line comment
     */
    parseSingleLineComment: function (stream, state) {
      stream.skipToEnd();
      return this.styles.comment;
    },




    /*
     * Checks for indentation bugs in Hyperlisp
     */
    checkIndentation: function (state, pos) {

      /*
       * Verifying that indentation is modulo 2, since everything else is a syntactic error for sure
       */
      if (pos % 2 != 0) {
        state.mode = 'error';
        return true;
      }

      /*
       * Verifying that indentation is no more than at the most "one additional indentation" (2 spaces) more than
       * previous value of indentation, or if first name starts with two spaces (which is a bug)
       */
      if (pos - state.previousIndent > 2 || (pos == 2 && state.noContent === true)) {
        state.mode = 'error';
        return true;
      }

      /*
       * Indentation is within acceptable range, updating state of indentation to next walkthrough,
       * but only if we're not given an empty string
       */
      state.indent = pos;
      state.previousIndent = pos;
      return false;
    },




    /*
     * Invoked to check to see if parser has found a "keyword", an "active event" invocation,
     * a "variable", etc, at which point the style of the element is overridden from its default
     */
    getNodeNameType: function (word, state) {
      switch (word) {

        /*
         * First p5 lambda keywords that requires indentation
         */
        case 'and':
        case 'or':
        case 'xor':
        case 'can-convert':
        case 'eval':
        case 'if':
        case 'else-if':
        case 'else':
        case 'set':
        case 'add':
        case 'retrieve':
        case 'fetch':
        case 'while':
        case 'for-each':
        case 'insert-before':
        case 'insert-after':
        case 'lock':
        case 'fork':
        case 'wait':
        case 'split':
        case 'join':
        case 'to-upper':
        case 'to-lower':
        case '+':
        case '-':
        case '/': // TODO: why doesn't this work ...?
        case '*':
        case '%':
        case '^':
        case 'lambda2lisp':
        case 'create-event':
        case 'create-protected-event':
        case 'login':
        case 'create-user':
        case 'eval-mutable':
        case 'move-file':
        case 'copy-file':
        case 'move-folder':
        case 'copy-folder':
        case 'save-file':
        case 'save-text-file':
        case 'save-binary-file':
        case 'update-data':
        case 'insert-data':
        case 'append-data':
        case 'set-context-value':
        case 'set-session-value':
        case 'set-global-value':
        case 'set-http-header':
        case 'set-widget-property':
        case 'set-cache-value':
        case 'set-cookie-value':
        case 'set-widget-ajax-event':
        case 'set-widget-lambda-event':
        case 'return-response-object':
        case 'raise-widget-ajax-event':
        case 'get-widget-property':
        case 'zip':
        case 'unzip':
        case 'set-page-value':
        case 'format-date':
        case 'edit-user':
        case 'match':
        case 'index-of':
        case 'replace':
        case 'try':
        case 'catch':
        case 'finally':
        case 'databind':
        case 'template':
        case 'sort':
        case 'switch':
        case 'case':
        case 'default':
        case 'find-widget':
        case 'find-widget-like':
        case 'find-first-ancestor-widget':
        case 'find-first-ancestor-widget-like':
        case 'find-first-descendant-widget':

          /*
           * This is a keyword that requires indentation
           */
          state.indent += 2;
          return this.styles.keyword;



        /*
         * Afterwards checking against keywords that does NOT need indentation
         */
        case 'not':
        case 'src':
        case 'sleep':
        case 'equals':
        case '=':
        case 'not-equals':
        case '!=':
        case 'more-than':
        case '>':
        case 'less-than':
        case '<':
        case 'more-than-equals':
        case '>=':
        case 'less-than-equals':
        case '<=':
        case '~':
        case 'contains':
        case '!~':
        case 'not-contains':
        case 'lisp2lambda':
        case 'sha256-hash':
        case 'widget-exist':
        case 'reload-location':
        case 'whoami':
        case 'logout':
        case 'list-roles':
        case 'sleep':
        case 'clear-widget':
        case 'delete-widget':
        case 'get-parent-widget':
        case 'get-children-widgets':
        case 'list-widgets':
        case 'get-widget-ajax-event':
        case 'get-widget-lambda-event':
        case 'list-widget-ajax-events':
        case 'list-widget-lambda-events':
        case 'include-javascript':
        case 'send-javascript':
        case 'include-javascript-file':
        case 'include-stylesheet-file':
        case 'set-title':
        case 'get-title':
        case 'set-location':
        case 'get-location':
        case 'get-base-location':
        case 'get-event':
        case 'file-exist':
        case 'load-file':
        case 'load-text-file':
        case 'load-binary-file':
        case 'delete-file':
        case 'create-folder':
        case 'folder-exist':
        case 'list-files':
        case 'list-folders':
        case 'delete-folder':
        case 'select-data':
        case 'delete-data':
        case 'get-context-value':
        case 'get-session-value':
        case 'list-context-keys':
        case 'list-session-keys':
        case 'get-application':
        case 'list-global-keys':
        case 'echo':
        case 'echo-file':
        case 'echo-mime':
        case 'delete-widget-property':
        case 'list-widget-properties':
        case 'list-page-keys':
        case 'get-page-value':
        case 'get-cache-value':
        case 'list-cache-keys':
        case 'get-cookie-value':
        case 'list-cookie-keys':
        case 'get-http-header':
        case 'list-http-headers':
        case 'get-http-param':
        case 'list-http-params':
        case 'get-http-method':
        case 'get-request-body':
        case 'delete-event':
        case 'vocabulary':
        case 'set-http-status':
        case 'set-http-status-code':
        case 'date-now':
        case 'create-cs-random':
        case 'list-users':
        case 'get-user':
        case 'delete-user':
        case 'abs':
        case 'acos':
        case 'asin':
        case 'atan':
        case 'ceiling':
        case 'floor':
        case 'cos':
        case 'cosh':
        case 'log':
        case 'log10':
        case 'round':
        case 'sin':
        case 'sinh':
        case 'sqrt':
        case 'tan':
        case 'tanh':
        case 'length':
        case 'throw':
        case 'eval-x':
        case 'return':
        case 'new-guid':
        case 'break':
        case 'continue':
        case 'url-encode':
        case 'url-decode':
        case 'html-encode':
        case 'html-decode':
        case 'request-is-mobile-device':
        case 'what':

          /*
           * This is a keyword that does NOT require indentation
           */
          return this.styles.keyword;




        /*
         * Then checking for widget types, and create widget invocations, 
         * that requires indentation
         */
        case 'create-widget':
        case 'create-container-widget':
        case 'create-literal-widget':
        case 'create-void-widget':
        case 'literal':
        case 'void':
        case 'container':
        case 'address':
        case 'article':
        case 'aside':
        case 'footer':
        case 'header':
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'nav':
        case 'section':
        case 'blockquote':
        case 'dd':
        case 'div':
        case 'dl':
        case 'dt':
        case 'figcaption':
        case 'figure':
        case 'li':
        case 'main':
        case 'ol':
        case 'p':
        case 'pre':
        case 'ul':
        case 'abbr':
        case 'b':
        case 'bdi':
        case 'bdo':
        case 'cite':
        case 'code':
        case 'data':
        case 'dfn':
        case 'em':
        case 'i':
        case 'kbd':
        case 'mark':
        case 'q':
        case 'rp':
        case 'rt':
        case 'rtc':
        case 'ruby':
        case 's':
        case 'samp':
        case 'small':
        case 'span':
        case 'strong':
        case 'sub':
        case 'sup':
        case 'svg':
        case 'time':
        case 'u':
        case 'var':
        case 'wbr':
        case 'a':
        case 'math':
        case 'iframe':
        case 'area':
        case 'audio':
        case 'map':
        case 'track':
        case 'video':
        case 'source':
        case 'img':
        case 'canvas':
        case 'del':
        case 'ins':
        case 'caption':
        case 'col':
        case 'colgroup':
        case 'table':
        case 'tbody':
        case 'td':
        case 'tfoot':
        case 'th':
        case 'thead':
        case 'tr':
        case 'button':
        case 'datalist':
        case 'fieldset':
        case 'input':
        case 'textarea':
        case 'keygen':
        case 'label':
        case 'legend':
        case 'meter':
        case 'optgroup':
        case 'option':
        case 'output':
        case 'progress':
        case 'select':
        case 'details':
        case 'dialog':
        case 'menu':
        case 'menuitem':
        case 'summary':
        case 'content':
        //case 'element': Clashes with [element] property of widgets, prioritizing [element] children of widget creation invocations ...
        case 'shadow':
        case 'template':

          /*
           * This is a widget, or create-widget invocation, that requires indentation
           */
          state.indent += 2;
          return this.styles.widget_type;




        /*
         * Then checking for widget types, which does NOT require indentation
         */
        case 'text':
        case 'hr':
        case 'br':

          /*
           * This is a widget type that does not require indentation
           */
          return this.styles.widget_type;




        /*
         * Then Widget properties, that requires indentation
         */
        case 'widgets':
        case 'events':

          /*
           * This is a widget property that requires indentation
           */
          state.indent += 2;
          return this.styles.widget_property;




        /*
         * Then Widget properties, that does NOT require indentation
         */
        case 'innerValue':
        case 'parent':
        case 'before':
        case 'after':
        case 'position':
        case 'element':
        case 'visible':
        case 'has-id':
        case 'render-type':

          /*
           * This is a widget property that does not require indentation
           */
          return this.styles.widget_property;




        /*
         * Then Widget attributes, that does NOT require indentation
         */
        case 'accesskey':
        case 'class':
        case 'contenteditable':
        case 'contextmenu':
        case 'dir':
        case 'hidden':
        case 'lang':
        case 'style':
        case 'tabindex':
        case 'title':
        case 'value':
        case 'href':

          /*
           * This is a widget attribute that does not require indentation
           */
          return this.styles.widget_attribute;




        /*
         * Then HTML attributes, requiring indentation, mostly DOM event handlers
         */
        case 'onclick':
        case 'ondblclick':
        case 'onmouseover':
        case 'onmouseout':
        case 'onchange':
        case 'oncontextmenu':
        case 'onmouseenter':
        case 'onmousedown':
        case 'onmouseleave':
        case 'onmousemove':
        case 'onmouseover':
        case 'onmouseup':
        case 'onkeydown':
        case 'onkeypress':
        case 'onkeyup':
        case 'onblur':
        case 'onfocus':
        case 'onfocusin':
        case 'onfocusout':
        case 'oninput':
        case 'oninvalid':
        case 'onsearch':
        case 'onselect':
        case 'ondrag':
        case 'ondragend':
        case 'ondragenter':
        case 'ondragleave':
        case 'ondragover':
        case 'ondragstart':
        case 'ondrop':
        case 'oncopy':
        case 'oncut':
        case 'onpaste':
        case 'onabort':
        case 'oncanplay':
        case 'oncanplaythrough':
        case 'ondurationchange':
        case 'onemptied':
        case 'onended':
        case 'onerror':
        case 'onloadeddata':
        case 'onloadedmetadata':
        case 'onloadstart':
        case 'onpause':
        case 'onplay':
        case 'onplaying':
        case 'onprogress':
        case 'onratechange':
        case 'onseeked':
        case 'onseeking':
        case 'onstalled':
        case 'onsuspend':
        case 'ontimeupdate':
        case 'onvolumechange':
        case 'onwaiting':
        case 'ontouchcancel':
        case 'ontouchend':
        case 'ontouchmove':
        case 'ontouchstart':
        case 'oninit':

          /*
           * This is an HTML element attribute that requires indentation
           */
          state.indent += 2;
          return this.styles.widget_attribute;


        /*
         * Default handling, simply checks if current name is either a
         * "variable" (starts with "_") or an Active Event invocation (contains ".")
         */
        default:
          if (word[0] == '_') {

            /*
             * The name of the node starts with an underscore "_", and hence is a "variable" (data segment)
             */
            return this.styles.variable;
          } else if (word.indexOf('.') != -1) {

            /*
             * The name of the node contains a period ".", and hence is considered to be an Active Event invocation
             */
            state.indent += 2;
            return this.styles.activeevent;
          } else if (word.indexOf('data-') == 0) {

            /*
             * The name of the node starts with "data-", and hence this is a custom HTML attribute.
             * Returning as "widget attribute" type
             */
            state.indent += 2;
            return this.styles.widget_attribute;
          }
          break;
      }
    }
  };
});

/*
 * Helper that defines MIME type of Hyperlisp content.
 * Not entirely sure where we'd need this, but possibly some plugins
 * created, that downloads code from JavaScript ...?
 */
CodeMirror.defineMIME("text/x-hyperlisp", "hyperlisp");



/*
 * Helper for showing autocomplete for Hyperlisp keywords
 */
CodeMirror.registerHelper("hint", "hyperlisp", function(cm, options) {

  /*
   * Checking if there are any autocomplete keywords, and if not, returning early
   */
  if (CodeMirror._hyperlispKeywords == null) {
    return;
  }

  /*
   * Finding current line in CodeMirror editor, such that we can use its content
   * as the basis for figuring out which keywords to show in autocomplete popup.
   * "curWord" should contain trimmed text from current line after this
   */
  var cur = cm.getCursor();
  var end = cur.ch;
  var list = [];
  var curLine = cm.getLine(cur.line);
  var curWord = curLine.trim();
  var start = end - curWord.length;

  /*
   * Then finding each word that matches from our Hyperlisp keywords list
   */
  for (var idx = 0; idx < CodeMirror._hyperlispKeywords.length; idx++) {
    if (CodeMirror._hyperlispKeywords[idx].indexOf (curWord) != -1) {

      /*
       * This keyword contains the text from current line in editor, hence
       * adding keyword back to caller
       */
      list.push(CodeMirror._hyperlispKeywords[idx]);
    }
  }
  return {list: list, from: CodeMirror.Pos(cur.line, start), to: CodeMirror.Pos(cur.line, end)};
});
});

