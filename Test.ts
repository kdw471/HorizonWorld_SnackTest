import {CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

/**
 * This is an example of a NetworkEvent that can be used to send data from the server to the clients.
 */
const TestEvent = new NetworkEvent<{greeting: string}>("TestEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class Test extends Component<typeof Test> {

  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private startServer() {
    // Noesis dataContext can't be directly controlled from the server
    // but server can send events to the clients so that they would update their dataContexts accordingly
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      console.log('NoesisUI: OnPlayerEnterWorld', player.name.get());
      this.sendNetworkEvent(player, TestEvent, {greeting: `Welcome ${player.name.get()}`});
    });
  }

  private startClient() {
    const dataContext = {
      label: "NoesisGUI",
      nested: {
        text: "Hello World",
      },
      items: [
        {
          label: "Item 1",
        },
        {
          label: "Item 2",
        },
      ],
      command: () => {
        console.log("Command invoked");
        dataContext.nested.text = "Boom!";
      }
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;
    // After a dataContext object is attached to a Noesis gizmo, it's automatically tracked for changes
    // so simply updating it will automatically update the UI.
    this.connectNetworkEvent(this.world.getLocalPlayer(), TestEvent, data => {
      console.log('NoesisUI: OnEvent', data);
      dataContext.label = data.greeting;
    });
  }
}

Component.register(Test);
