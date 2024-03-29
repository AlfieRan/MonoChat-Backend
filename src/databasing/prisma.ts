import { PrismaClient } from "@prisma/client";
import { UserType, LoginType, MessageInfo } from "../types";
import { hash, verify } from "argon2";
export const prisma = new PrismaClient();

export async function UserSearch(search: string) {
  //TODO fix this
  const name: string = search;
  const UserMatches = await prisma.user.findMany({
    where: {
      name: {
        contains: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
    },
    take: 5,
  });
  return UserMatches;
}

export async function UserInfo(usrId: string) {
  const UserInfo = await prisma.user.findUnique({
    where: {
      id: usrId,
    },
    select: {
      name: true,
    },
  });
  return UserInfo;
}

export async function GetUserFriends(userId: string) {
  const usrData = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: true, followers: true },
  });

  let friends: any[] = [];
  let TmpA: any[];
  let TmpB: any[];

  if (usrData.following.length < usrData.followers.length) {
    TmpA = usrData.following;
    TmpB = usrData.followers;
  } else {
    TmpB = usrData.following;
    TmpA = usrData.followers;
  }

  for (let i = 0; i < TmpA.length; i++) {
    if (TmpA[i] in TmpB) {
      friends.push(TmpA[i]);
    }
  }

  return friends;
}

export async function FollowUser(userId: string, userToFollow: string) {
  const data = await prisma.user.update({
    where: { id: userId },
    data: {
      following: {
        connect: {
          id: userToFollow,
        },
      },
    },
  });
}

export async function DoesUserExist_Email(email: string) {
  const matchCount = await prisma.user.count({ where: { email: email } });
  if (matchCount > 0) {
    return true;
  } else {
    return false;
  }
}

export async function DoesUserExist_Id(id: string) {
  const matchCount = await prisma.user.count({ where: { id: id } });
  if (matchCount > 0) {
    return true;
  } else {
    return false;
  }
}

export async function isUserInChat(chatid: string, userid: string) {
  const members = (
    await prisma.chat.findUnique({
      where: {
        id: chatid,
      },
      select: {
        members: { select: { id: true } },
      },
    })
  ).members;

  for (let i = 0; i < members.length; i++) {
    if (userid === members[i].id) {
      return true;
    }
  }

  return false;
}

export async function VerifyLoginDetails(LoginInfo: LoginType) {
  const usrDetails = await prisma.user.findUnique({
    where: {
      email: LoginInfo.email,
    },
  });
  if (await verify(usrDetails.password, LoginInfo.password)) {
    return { successful: true, id: usrDetails.id };
  } else {
    return { successful: false, error: "Incorrect Login Information" };
  }
}

export async function SignUp(UserInfo: UserType) {
  let hashedPass = await hash(UserInfo.password);
  const NewUser = await prisma.user.create({
    data: {
      name: UserInfo.name,
      email: UserInfo.email,
      password: hashedPass,
      description: "",
      nationality: "",
    },
  });

  return NewUser;
}

export async function GetChatMessages(ChatId: string) {
  const messages = await prisma.chat.findUnique({
    where: { id: ChatId },
    select: {
      messages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          sender: { select: { name: true, id: true } },
        },
        take: 50,
      },
    },
  });

  return messages;
}

export async function SendMessage(
  Contents: string,
  UserId: string,
  ChatId: string
) {
  const msg: MessageInfo = await prisma.message.create({
    data: {
      content: Contents,
      sender: {
        connect: {
          id: UserId,
        },
      },
      chat: { connect: { id: ChatId } },
    },
    select: {
      id: true,
      content: true,
      sender: { select: { id: true, name: true } },
    },
  });

  return msg;
}

export async function GetChatInfo(ChatId: string) {
  const info = await prisma.chat.findUnique({
    where: { id: ChatId },
    select: { chatname: true, members: { select: { id: true, name: true } } },
  });
  return info;
}

export async function GetMessageInfo(MsgId: string) {
  const info = await prisma.message.findUnique({
    where: { id: MsgId },
    select: { content: true, userId: true, createdAt: true },
  });
  return info;
}

export async function isChatPublic(ChatId: string) {
  const isPublic = await prisma.chat.findUnique({
    where: {
      id: ChatId,
    },
    select: {
      ispublic: true,
    },
  });

  if (isPublic.ispublic) {
    return true;
  } else {
    return false;
  }
}

export async function GetUserChats(Userid: string) {
  const UserChats = await prisma.user.findUnique({
    where: {
      id: Userid,
    },
    select: {
      chats: {
        select: { chatname: true, id: true, isdirect: true },
      },
    },
  });

  for (let i = 0; i < UserChats.chats.length; i++) {
    if (UserChats.chats[i].isdirect) {
      const otherUser = await GetOtherUserInDirect(
        UserChats.chats[i].id,
        Userid
      );
      UserChats.chats[i].chatname = otherUser;
    }
  }

  return UserChats;
}

async function GetOtherUserInDirect(chatid: string, userid: string) {
  const members = await prisma.chat.findUnique({
    where: {
      id: chatid,
    },
    select: {
      members: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (userid === members.members[0].id) {
    return members.members[1].name;
  } else {
    return members.members[0].name;
  }
}

export async function GetUserToUserChat(userAid: string, userBid: string) {
  const MatchingChats = (
    await prisma.user.findUnique({
      where: {
        id: userAid,
      },
      select: {
        chats: {
          where: { members: { some: { id: userBid } }, isdirect: true },
          select: { id: true, members: { select: { id: true } } },
        },
      },
    })
  ).chats;

  for (let i = 0; i < MatchingChats.length; i++) {
    if (MatchingChats[i].members.length === 2) {
      return MatchingChats[i].id;
    }
  }

  // This bit only runs if there wasn't a match previously, as that would've returned the function
  const UserAName = (
    await prisma.user.findUnique({
      where: { id: userAid },
      select: { name: true },
    })
  ).name;

  const UserBName = (
    await prisma.user.findUnique({
      where: { id: userBid },
      select: { name: true },
    })
  ).name;

  const newChatId = (
    await prisma.chat.create({
      data: {
        chatname: `${UserAName} and ${UserBName}`,
        ispublic: false,
        members: { connect: [{ id: userAid }, { id: userBid }] },
        isdirect: true,
      },
      select: {
        id: true,
      },
    })
  ).id;

  return newChatId;
}
