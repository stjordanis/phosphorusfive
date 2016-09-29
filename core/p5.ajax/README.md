Ajax on steroids
========

This project contains the main Ajax library for Phosphorus Five. This Ajax library can be consumed
either stand alone, in any ASP.NET Web Forms application, since its controls inherit from
_System.Web.UI.Control_ - Or indirectly, through using the p5.web library, allowing
you to create controls with Active Events, using for instance Hyperlisp as your programming 
language.

In our documentation here, we will assume some C# knowledge, and create our examples,
as "pure" ASP.NET examples. If you wish to see it further abstracted, the way you'd probably
normally use it, in combination with P5, then I encourage you to rather check out the documentation
for "p5.web".

## The trinity of widgets

In general there are only three Ajax controls, or "widgets", as we usually refer to them as, 
giving you 100% control over your page's HTML structure;

* Container - A "panel" type of widget, having children widgets of itself
* Literal - A web control containing text, and/or HTML as its content
* Void - A web control with neither children controls, nor textual fragment content

To create a property for your widget(s), simply use the subscript operator, with
the name being the property name, and its value being the value. To change the HTML 
element a widget is rendered with, simply set its `Element` property.

The above two traits of p5.ajax, allows you to aquire 100% perfect control over what
HTML is rendered to your clients. And since the `Container` widget allows you to
dynamically add and remove widgets from its children Controls collecction, this allows
you to create any type of markup you wish, dynamically building up your website's HTML,
exactly as you need.

p5.ajax does not have a "Tree Ajax Control" or a "DataGrid Ajax Control", simply
because it is not its responsibility to create such Controls/widgets. However, to
create these as extension controls, utilizing the three pre-existing widgets from p5.ajax,
would be very easy, and could probably be done, without having to resort to JavaScript
at all.

## No more keeping track of your controls

The Container widget, will automatically track its children Controls collection,
as long as you use the `CreatePersistentControl`, and `RemoveControlPersistent` methods
for adding and removing controls from its collection.

This means, that you do not need to re-create its controls collection upon postbacks or callbacks,
since it'll keep track of whatever controls it contains, at any specific point in time,
automatically for you.

You can add and remove any control(s) you wish from a Container widget, as
long as you use the above mentioned methods. The controls will be automatically
re-created upon every postback and/or callback to your server. Which of course,
for beginners in ASP.NET, entirely removes the burdon of having to keep track
of which controls have been previously created.

## Example usage in C#

Create a reference to *"p5.ajax.dll"* in your ASP.NET Web Forms application,
and make sure you have a "Default.aspx" page.

Then modify your web.config, and make sure it has something like this inside its 
*"system.web"* section, to recognize the p5.ajax controls.

```xml
<system.web>
  <pages>
    <controls>
      <add 
        assembly="p5.ajax" 
        namespace="p5.ajax.widgets" 
        tagPrefix="p5" />
    </controls>
  </pages>
</system.web>
```

Then either inherit your page from AjaxPage, or implement the IAjaxPage interface, 
before you create a literal widget, by adding the code below in your .aspx markup.

```xml
<p5:Literal
    runat="server"
    id="hello"
    Element="strong"
    onclick="hello_onclick">
    click me
</p5:Literal>
<p5:Container
    runat="server"
    id="hello_ul"
    Element="ul"
    click me
</p5:Container>
```

Then add the following code in your codebehind

```csharp
using p5.ajax.core;
using p5.= p5.ajax.widgets;

/* ... rest of class ... */

p5.Container hello_ul;

[WebMethod]
protected void hello_onclick (p5.Literal sender, EventArgs e)
{
    // Notice, no cast here ...
    sender.innerValue = "hello world";
    sender["style"] = "background-color:LightBlue;";

    // Dynamically adding a new "li" HTML element to our ul container.
    // Notice, if we want our Container control to take care of persistence
    // of our newly created child control, we must create it through the Container's
    // factory method, indirectly!
    Literal lit = hello_ul.CreatePersistentControl<Literal> ();
    lit.Element = "li";
    lit["class"] = "some-class-value";
    lit.innerValue = "Item no; " + hello_ul.Controls.Count;
}

/* ... */
```

For security reasons, you must explicitly mark your server-side Ajax methods with 
the [WebMethod] attribute.

## Structure of p5.ajax

All three widgets described above, inherit from the "Widget" class. This class takes
care of attribute creation, deletion, and so on. And all attributes added to any control,
will be automatically remembered across postbacks.

Due to the automatic attribute serialization de-serialization, and stateful Container
controls, using p5.ajax is extremely easy. Simply add and/or change/remove any attribute
you wish from your controls, and have the underlaying library take care of the automatic 
changes being propagated back to the client.

To add an attribute, or change its value, is as simple as this.

```csharp
// Notice, this does NOT render as "valid" HTML! But it proves the point!
myWidget ["some-attribute"] = "some-value";
```

To delete an attribute, simply use the `RemoveAttribute` method on your widget, and pass in 
the nameof the attribute you wish to remove.

## Change is the only constant

In p5.ajax, everything can be changed during an Ajax request. As we've seen in previous
parts of this documentation, the Container widget keeps track of its children controls.
But also all other parts of a widget is automatically kept track of during execution
of your page. In fact, you can even change the element a widget is rendered with, 
dynamically - And even its ID - And p5.ajax will automatically take care of everything
that changes, and render the correct HTML/JSON back to the client.

Imagine you have a "myWidget" on your page, which can be any of the three existing types
of widgets, and then you do something like this in one of your web methods.

```csharp
myWidget.Element = "div";
```

The above would change your widget's HTML element, and persist (remember) the change for 
every consecutive callback.

## JSON

p5.ajax uses JSON internally to return updates back to the client. This means, that among
other things, it rarely needs to re-render your controls, using "partial rendering". You can 
also inject any new control, in a postback or Ajax callback, at any position in your 
page, as long as its parent control, is of type "Container", and you use the "factory method"
to create your controls.

The JSON parts of p5.ajax, means that the bandwidth consumption when consuming the library,
is ridiculously small, compared to frameworks built around "partial rendering", which requires
some portion of the page, to be "partially re-rendered".

This also makes the client-side JavaScript parts of P5 tiny compared to other Ajax "frameworks".
In its release build, minified and GZipped, the entire JavaScript parts to p5.ajax, is actually
no more than 5KB.

## ViewState

The ViewState is "bye, bye" in p5.ajax. Or rather, to be correct, it is kept, but on
the server side of things. This means that the amount of data sent back and forth
between your clients and server, is probably less than a fraction of what you are used
to from other Ajax frameworks, such as ASP.NET Ajax and similar frameworks.

The above have some consequences though, which is that the memory consumption on the
server, increases for each session object that connects to it simultaneously.

"Out of the box", without tweaking the library, this means that it is best suited
for building web apps, where you don't have an extreme amount of simultaneously
users. As a general rule, I'd suggest using p5.ajax for building "enterprise apps",
without too many simultaneous users, and not for instance, social media websites, 
such as Facebook or Twitter, for the above mentioned reasons.

Another consequence, is that (by default), only 5 simultaneous tabs are tolerated
at the same time, for each session object. If the user opens up a sixth tab,
and/or refreshes one of his pages more than 5 times, then the "oldest" ViewState key
is invalidated, and the next Ajax request towards the server, will be rejected, from 
that page, due to a non-valid ViewState lookup. If this was not the case, a single
session (user), could exhaust your server's memory, simply by refreshing his webpage,
thousands of times.

Have this in mind as you do your p5.ajax development. The library is best suited for
"single page web apps", with complex and rich UI, doing lots of Ajax requests.
It is not as well suited for apps, where you have many tabs open at the same time,
or thousands of simultaneous users, such as for instance would often be the case 
with social media websites, such as StackOverflow, Facebook or Twitter etc ...

As a general rule, I encourage people to use it to build "Enterprise Apps", while
use something else to build websites, requiring thousands, and sometimes millions 
of simultaneous users. Although it could probably be tweaked to handle also such 
scenarios.

The ViewState logic _can_ be overridden though, by implementing your own IAjaxPage,
and/or tweaking your web.config.

## More example code

To see an example of the p5.ajax library in use directly, without anything else but the
Ajax library itself, please see the website project called "p5.ajax-samples", that can be
found within the "samples" folder. To test this project, make sure you set it as your 
"startup" project in Visual Studio, Xamarin or MonoDevelop, and start your debugger.

